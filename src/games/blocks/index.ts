import { onMountRollback } from '../shared/lifecycle';
import { isEn, T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { createStore } from '../../services/storage';
import {
  BlocksState,
  canPlace,
  COMBO_GRACE,
  comboMult,
  createBlocks,
  hasMove,
  N,
  nextTier,
  Piece,
  place,
  shapeById,
  tierOf,
  TIERS,
  wouldClear,
} from './logic';

const TIER_EN: Record<string, string> = { Bronze: 'Bronze', Prata: 'Silver', Ouro: 'Gold', Diamante: 'Diamond' };

const HELP_PT = `<ul>
<li><b>Objetivo:</b> fazer o máximo de pontos encaixando as peças na grade 8×8.</li>
<li><b>Jogar:</b> arraste uma peça da bandeja até a grade e solte. As peças não giram.</li>
<li>Linha ou coluna completa <b>some</b>. Quando as 3 peças da bandeja acabam, chegam outras 3.</li>
<li><b>Fim:</b> quando nenhuma peça da bandeja cabe mais na grade.</li>
<li><b>Pontos:</b> +1 por quadradinho colocado. Limpar 1 linha = 10, 2 de uma vez = 30, 3 = 60, 4 = 100.</li>
<li><b>Combo:</b> cada jogada seguida que limpa aumenta o multiplicador (×1,5, ×2… até ×5). Você pode fazer até
${COMBO_GRACE - 1} jogadas sem limpar sem perder o combo; na ${COMBO_GRACE}ª ele zera.</li>
<li>Grade totalmente vazia: bônus de +300.</li>
<li><b>Faixas:</b> ${TIERS.map((t) => `${t.name} ${t.min.toLocaleString('pt-BR')}`).join(' · ')}.</li>
<li><b>2 jogadores:</b> cada um joga uma partida inteira, um depois do outro; maior pontuação vence.</li>
<li><b>Teclado:</b> 1, 2, 3 escolhem a peça; setas movem; Enter ou espaço encaixam.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> score as many points as you can by fitting pieces into the 8×8 grid.</li>
<li><b>Play:</b> drag a piece from the tray onto the grid and release. Pieces don't rotate.</li>
<li>A full row or column <b>clears</b>. When the 3 tray pieces are used, 3 new ones arrive.</li>
<li><b>Game over:</b> when no tray piece fits on the grid anymore.</li>
<li><b>Points:</b> +1 per square placed. Clearing 1 line = 10, 2 at once = 30, 3 = 60, 4 = 100.</li>
<li><b>Combo:</b> each move in a row that clears raises the multiplier (×1.5, ×2… up to ×5). You can make up to
${COMBO_GRACE - 1} moves without clearing and keep the combo; on the ${COMBO_GRACE}rd it resets.</li>
<li>Completely empty board: +300 bonus.</li>
<li><b>Tiers:</b> ${TIERS.map((t) => `${TIER_EN[t.name]} ${t.min.toLocaleString('en-US')}`).join(' · ')}.</li>
<li><b>2 players:</b> each plays a full game, one after the other; highest score wins.</li>
<li><b>Keyboard:</b> 1, 2, 3 pick a piece; arrows move; Enter or space place it.</li>
</ul>`;

/** Paleta própria (cores 1..7 da lógica). */
const PALETTE = ['#ff5d73', '#ff9f43', '#ffd84d', '#4fe08a', '#35d0e0', '#5a8dff', '#b57cff'];

interface Save {
  best: number;
  games: number;
  bestLines: number;
}
const store = createStore<Save>(
  'jogaco.blocks.v1',
  1,
  () => ({ best: 0, games: 0, bestLines: 0 }),
  (x): x is Save => {
    const o = x as Save;
    return !!o && [o.best, o.games, o.bestLines].every((n) => Number.isFinite(n) && n >= 0);
  },
);

const loc = () => (isEn() ? 'en-US' : 'pt-BR');
const fmt = (n: number) => Math.round(n).toLocaleString(loc());
const tn = (name: string) => (isEn() ? TIER_EN[name] ?? name : name);
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

interface Drag {
  idx: number;
  px: number;
  py: number;
  lift: number;
  /** Encaixe atual (null = fora / não cabe). */
  at: { r: number; c: number } | null;
}
interface Fading {
  r: number;
  c: number;
  color: number;
  t: number;
}
interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
}

class BlocksGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: StartConfig | null = null;
  private s: BlocksState | null = null;
  private save: Save = store.load();
  /** 2P: de quem é a vez (cada um joga uma partida inteira). */
  private turn: 0 | 1 = 0;
  private scores: [number | null, number | null] = [null, null];
  private raf = 0;
  private last = 0;
  private t = 0;
  private dpr = 1;
  private u = 30;
  private bx = 0;
  private by = 0;
  private portrait = true;
  private slots: { x: number; y: number; w: number; h: number }[] = [];
  private drag: Drag | null = null;
  private kb: { idx: number; r: number; c: number } | null = null;
  private fading: Fading[] = [];
  private placed: { r: number; c: number; t: number }[] = [];
  private popups: Popup[] = [];
  private born = new Map<number, number>();
  private fx = new ParticleSystem();
  private ac = new AbortController();
  private disposed = false;
  private overTimer = 0;
  private newRecord = false;

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'blocks',
      title: T('Blocos Cromáticos', 'Chromatic Blocks'),
      subtitle: T('Encaixe, limpe linhas, faça combos', 'Fit pieces, clear lines, chain combos'),
      modes: { solo: T('Jogar', 'Play'), local: true },
      localNote: T('Cada um joga uma partida inteira, um depois do outro. Maior pontuação vence.', 'Each plays a full game, one after the other. Highest score wins.'),
      // "Seven Blue Tiles" (Leon, Gemini): 110 BPM, 72 compassos (157 s), -14 LUFS.
      musicUrl: './music/seven-blue-tiles.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => {
        this.cfg = cfg;
        this.scores = [null, null];
        this.startTurn(0);
      },
      onPause: (p) => {
        this.drag = null;
        if (!p) this.last = performance.now();
      },
      onRestart: () => {
        if (!this.cfg) return;
        this.scores = [null, null];
        this.startTurn(0);
      },
      onMenu: () => {
        clearTimeout(this.overTimer);
        this.s = null;
        this.drag = null;
        this.kb = null;
        this.shell.setScore('');
        this.shell.setSubtitle(T('Encaixe, limpe linhas, faça combos', 'Fit pieces, clear lines, chain combos'));
      },
      menuNote: () =>
        this.save.best ? `${T('Seu recorde', 'Your record')}: ${fmt(this.save.best)} ${T('pontos', 'points')}${tierOf(this.save.best) ? ` (${tn(tierOf(this.save.best)!.name)})` : ''}` : T('Sem recorde ainda.', 'No record yet.'),
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Grade de blocos 8 por 8 e bandeja de peças', '8 by 8 block grid and piece tray'));
    this.cv.style.touchAction = 'none';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.bindInput();
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.overTimer);
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  // ------------------------------------------------------------ partida
  private startTurn(p: 0 | 1) {
    clearTimeout(this.overTimer);
    if (p === 0) this.shell.beginMatch();
    this.turn = p;
    this.s = createBlocks();
    this.drag = null;
    this.kb = null;
    this.fading = [];
    this.placed = [];
    this.popups = [];
    this.newRecord = false;
    this.fx.clear();
    this.markBorn();
    this.shell.k('r-again').textContent = T('Revanche', 'Rematch');
    this.shell.setTurn(p);
    this.paintHud();
    if (this.cfg?.mode === 'local') this.shell.toast(`${T('Vez de', 'Turn:')} ${this.cfg.names[p]}.`, 1600);
  }

  private markBorn() {
    for (const pc of this.s?.tray ?? []) if (pc && !this.born.has(pc.uid)) this.born.set(pc.uid, this.t);
  }

  private paintHud() {
    const s = this.s;
    const cfg = this.cfg;
    if (!s || !cfg) return;
    if (cfg.mode === 'local') {
      const val = (p: 0 | 1) => (p === this.turn ? fmt(s.score) : this.scores[p] === null ? '–' : fmt(this.scores[p]!));
      this.shell.setScore(Shell.pill(0, cfg.names[0], val(0), this.turn === 0) + Shell.pill(1, cfg.names[1], val(1), this.turn === 1));
    } else {
      // sem rótulo: no celular em pé o título do HUD precisa do espaço
      this.shell.setScore(Shell.pill(0, '', fmt(s.score), true));
    }
    let sub: string;
    if (s.streak > 1) {
      const left = COMBO_GRACE - s.sinceClear;
      sub = isEn()
        ? `Combo ×${comboMult(s.streak).toLocaleString('en-US')} · clear within ${left} move${left > 1 ? 's' : ''} to keep it`
        : `Combo ×${comboMult(s.streak).toLocaleString('pt-BR')} · limpe em até ${left} jogada${left > 1 ? 's' : ''} para manter`;
    } else {
      const nt = nextTier(s.score);
      const tier = tierOf(s.score);
      sub = nt ? `${tier ? tn(tier.name) + ' · ' : ''}${tn(nt.name)} ${T('em', 'at')} ${fmt(nt.min)}` : T('Diamante!', 'Diamond!');
      if (cfg.mode === 'solo' && this.save.best) sub += ` · ${T('recorde', 'record')} ${fmt(Math.max(this.save.best, s.score))}`;
    }
    this.shell.setSubtitle(sub);
  }

  private tryPlace(idx: number, r: number, c: number): boolean {
    const s = this.s;
    if (!s || s.over || this.shell.paused) return false;
    const pc = s.tray[idx];
    if (!pc) return false;
    const res = place(s, idx, r, c);
    if (!res) {
      this.shell.sfx.tone(150, 0.12, 0.08, 'square', 0.8);
      return false;
    }
    const u = this.u;
    for (const [dr, dc] of pc.shape.cells) this.placed.push({ r: r + dr, c: c + dc, t: this.t });
    this.shell.sfx.noise(900, 0.05, 0.3, 3);
    this.shell.sfx.tone(220, 0.07, 0.15, 'sine', 0.8);
    const L = res.rows.length + res.cols.length;
    if (L) {
      for (const cell of res.clearedCells) {
        this.fading.push({ ...cell, t: this.t });
        if ((cell.r + cell.c) % 2 === 0) this.fx.burst('confete', this.bx + (cell.c + 0.5) * u, this.by + (cell.r + 0.5) * u, u * 0.12);
      }
      const base = 523 * Math.pow(2, Math.min(res.streak - 1, 9) / 12);
      for (let i = 0; i < Math.min(L, 4); i++) this.shell.sfx.tone(base * [1, 1.26, 1.5, 2][i], 0.22, 0.11, 'triangle', 1, i * 0.07);
      // pontos perto do centro da peça
      const cx = this.bx + (c + pc.shape.w / 2) * u;
      const cy = this.by + (r + pc.shape.h / 2) * u;
      const label = L > 1 ? `${L} ${T('linhas!', 'lines!')} +${fmt(res.clearPts)}` : `+${fmt(res.clearPts)}`;
      this.popups.push({ x: cx, y: cy, text: label, color: '#ffffff', t: this.t, big: true });
      if (res.mult > 1) this.popups.push({ x: cx, y: cy + u * 0.75, text: `Combo ×${res.mult.toLocaleString(loc())}`, color: '#ffd84d', t: this.t, big: false });
      if (res.boardClear) {
        this.popups.push({ x: this.bx + 4 * u, y: this.by + 3 * u, text: T('Grade limpa! +300', 'Board clear! +300'), color: '#7fe7ff', t: this.t, big: true });
        this.shell.sfx.win();
      }
    }
    this.markBorn();
    this.paintHud();
    if (s.over) this.gameOver();
    return true;
  }

  private gameOver() {
    const s = this.s!;
    const cfg = this.cfg!;
    this.shell.sfx.lose();
    this.shell.toast(T('Sem espaço para as peças!', 'No room for the pieces!'), 1800);
    if (cfg.mode === 'solo') {
      this.shell.report(cfg, null);
      this.save.games++;
      this.save.bestLines = Math.max(this.save.bestLines, s.lines);
      if (s.score > this.save.best) {
        this.save.best = s.score;
        this.newRecord = s.score > 0;
      }
      store.save(this.save);
    }
    const snap = s;
    this.overTimer = window.setTimeout(() => {
      if (this.disposed || this.s !== snap) return;
      const tier = tierOf(snap.score);
      const tierTxt = tier ? `${T('Faixa', 'Tier')} ${tn(tier.name)}. ` : '';
      if (cfg.mode === 'solo') {
        const nt = nextTier(snap.score);
        this.shell.showResult(
          this.newRecord ? T('Novo recorde!', 'New record!') : T('Fim de jogo', 'Game over'),
          isEn()
            ? `${fmt(snap.score)} points · ${snap.lines} ${snap.lines === 1 ? 'line' : 'lines'} · best combo ${snap.bestStreak}. ${tierTxt}${nt ? `Next tier: ${tn(nt.name)} (${fmt(nt.min)}). ` : ''}Record: ${fmt(this.save.best)}.`
            : `${fmt(snap.score)} pontos · ${snap.lines} ${snap.lines === 1 ? 'linha' : 'linhas'} · melhor combo ${snap.bestStreak}. ${tierTxt}${nt ? `Próxima faixa: ${nt.name} (${fmt(nt.min)}). ` : ''}Recorde: ${fmt(this.save.best)}.`,
          () => this.startTurn(0),
        );
        return;
      }
      this.scores[this.turn] = snap.score;
      if (this.turn === 0) {
        this.shell.showResult(
          `${cfg.names[0]}: ${fmt(snap.score)} ${snap.score === 1 ? T('ponto', 'point') : T('pontos', 'points')}`,
          `${tierTxt}${T('Agora é a vez de', 'Now it is the turn of')} ${cfg.names[1]}. ${T('Passe o aparelho.', 'Pass the device.')}`,
          () => this.startTurn(1),
        );
        this.shell.k('r-again').textContent = `${T('Começar', 'Start')} (${cfg.names[1]})`;
        return;
      }
      const [a, b] = this.scores as [number, number];
      this.shell.report(cfg, a === b ? 'draw' : a > b ? 0 : 1);
      const title = a === b ? T('Empate!', 'Draw!') : `${cfg.names[a > b ? 0 : 1]} ${T('venceu!', 'wins!')}`;
      this.shell.setTurn(a === b ? null : a > b ? 0 : 1);
      this.shell.showResult(title, `${cfg.names[0]} ${fmt(a)} × ${fmt(b)} ${cfg.names[1]}`, () => {
        this.scores = [null, null];
        this.startTurn(0);
      });
    }, 1500);
  }

  // ------------------------------------------------------------ entrada
  private toCanvas(e: { clientX: number; clientY: number }) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private canAct() {
    return !!this.s && !this.s.over && !this.shell.paused && !this.shell.overlayOpen();
  }

  private slotAt(x: number, y: number): number {
    return this.slots.findIndex((sl) => x >= sl.x && x <= sl.x + sl.w && y >= sl.y && y <= sl.y + sl.h);
  }

  /** Canto superior esquerdo da peça arrastada → casa mais próxima. */
  private snap(d: Drag): { r: number; c: number } | null {
    const pc = this.s?.tray[d.idx];
    if (!pc) return null;
    const u = this.u;
    const tlx = d.px - (pc.shape.w * u) / 2;
    const tly = d.py - d.lift - (pc.shape.h * u) / 2;
    const c = Math.round((tlx - this.bx) / u);
    const r = Math.round((tly - this.by) / u);
    return canPlace(this.s!.grid, pc.shape, r, c) ? { r, c } : null;
  }

  private bindInput() {
    const cv = this.cv;
    const sig = { signal: this.ac.signal };
    cv.addEventListener('pointerdown', (e) => {
      this.shell.sfx.unlock();
      if (!this.canAct()) return;
      const { x, y } = this.toCanvas(e);
      const idx = this.slotAt(x, y);
      if (idx < 0 || !this.s!.tray[idx]) return;
      const pc = this.s!.tray[idx]!;
      // no toque, a peça sobe acima do dedo para não ficar escondida
      const lift = e.pointerType === 'mouse' ? 0 : (pc.shape.h * this.u) / 2 + this.u * 0.9;
      this.drag = { idx, px: x, py: y, lift, at: null };
      this.drag.at = this.snap(this.drag);
      this.kb = null;
      cv.setPointerCapture(e.pointerId);
      this.shell.sfx.tone(660, 0.04, 0.08, 'triangle', 1.2);
    });
    cv.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const { x, y } = this.toCanvas(e);
      d.px = x;
      d.py = y;
      d.at = this.snap(d);
    });
    const end = (e: PointerEvent, cancel: boolean) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
      if (cancel) return;
      const { x, y } = this.toCanvas(e);
      d.px = x;
      d.py = y;
      const at = this.snap(d);
      if (at) this.tryPlace(d.idx, at.r, at.c);
      else if (this.slotAt(x, y) < 0) this.shell.sfx.tone(150, 0.1, 0.06, 'square', 0.8);
    };
    cv.addEventListener('pointerup', (e) => end(e, false));
    cv.addEventListener('pointercancel', (e) => end(e, true));
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.canAct()) return;
        const s = this.s!;
        const k = e.key;
        if (/^[1-3]$/.test(k)) {
          const i = Number(k) - 1;
          if (!s.tray[i]) return;
          const sh = s.tray[i]!.shape;
          this.kb = { idx: i, r: Math.floor((N - sh.h) / 2), c: Math.floor((N - sh.w) / 2) };
        } else if (this.kb && k.startsWith('Arrow')) {
          const sh = s.tray[this.kb.idx]!.shape;
          if (k === 'ArrowLeft') this.kb.c = Math.max(0, this.kb.c - 1);
          if (k === 'ArrowRight') this.kb.c = Math.min(N - sh.w, this.kb.c + 1);
          if (k === 'ArrowUp') this.kb.r = Math.max(0, this.kb.r - 1);
          if (k === 'ArrowDown') this.kb.r = Math.min(N - sh.h, this.kb.r + 1);
        } else if (this.kb && (k === 'Enter' || k === ' ')) {
          if (this.tryPlace(this.kb.idx, this.kb.r, this.kb.c)) this.kb = null;
        } else return;
        e.preventDefault();
      },
      sig,
    );
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    if (!this.shell.paused) {
      this.t += dt;
      this.fx.update(dt);
      this.fading = this.fading.filter((f) => this.t - f.t < 0.45);
      this.placed = this.placed.filter((f) => this.t - f.t < 0.3);
      this.popups = this.popups.filter((p) => this.t - p.t < 1.1);
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    const W = Math.max(200, st.clientWidth - 8);
    const H = Math.max(200, st.clientHeight - 6);
    this.portrait = H > W * 1.05;
    let u: number;
    if (this.portrait) {
      u = Math.floor(Math.min(W / 8.3, H / 11.8));
    } else {
      u = Math.floor(Math.min(H / 8.3, W / 13));
    }
    u = Math.max(14, u);
    this.u = u;
    const cw = this.portrait ? Math.floor(u * 8.3) : Math.floor(u * 13);
    const ch = this.portrait ? Math.floor(u * 11.8) : Math.floor(u * 8.3);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cv.style.width = `${cw}px`;
    this.cv.style.height = `${ch}px`;
    this.cv.width = Math.floor(cw * this.dpr);
    this.cv.height = Math.floor(ch * this.dpr);
    this.bx = u * 0.15;
    this.by = u * 0.15;
    this.slots = [];
    if (this.portrait) {
      const w = (8 * u) / 3;
      for (let i = 0; i < 3; i++) this.slots.push({ x: this.bx + i * w, y: this.by + 8.35 * u, w, h: 3.2 * u });
    } else {
      const x = this.bx + 8.55 * u;
      const h = (8 * u) / 3;
      for (let i = 0; i < 3; i++) this.slots.push({ x, y: this.by + i * h, w: 4.15 * u, h });
    }
  }

  private tile(x: number, y: number, size: number, color: number, alpha = 1) {
    const ctx = this.ctx;
    const base = PALETTE[(color - 1) % PALETTE.length];
    const pad = size * 0.06;
    const s = size - pad * 2;
    const r = s * 0.2;
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, y + pad, 0, y + pad + s);
    g.addColorStop(0, shade(base, 0.28));
    g.addColorStop(1, shade(base, -0.22));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, s, s, r);
    ctx.fill();
    // brilho interno: faixa clara em cima e borda escura embaixo
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.roundRect(x + pad + s * 0.14, y + pad + s * 0.1, s * 0.72, s * 0.16, s * 0.08);
    ctx.fill();
    ctx.strokeStyle = shade(base, -0.45);
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, s, s, r);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawPiece(pc: Piece, x: number, y: number, size: number, alpha = 1) {
    for (const [dr, dc] of pc.shape.cells) this.tile(x + dc * size, y + dr * size, size, pc.color, alpha);
  }

  private draw() {
    const ctx = this.ctx;
    const u = this.u;
    const W = this.cv.width / this.dpr;
    const H = this.cv.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bx = this.bx;
    const by = this.by;
    // tabuleiro
    ctx.fillStyle = '#0d1030';
    ctx.strokeStyle = 'rgba(140,160,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - u * 0.1, by - u * 0.1, 8.2 * u, 8.2 * u, u * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        ctx.beginPath();
        ctx.roundRect(bx + c * u + u * 0.07, by + r * u + u * 0.07, u * 0.86, u * 0.86, u * 0.16);
        ctx.fill();
      }
    const s = this.s;
    if (!s) return;
    // prévia (arraste ou teclado): onde cai + linhas que vão sumir
    let ghost: { pc: Piece; r: number; c: number } | null = null;
    if (this.drag?.at) ghost = { pc: s.tray[this.drag.idx]!, ...this.drag.at };
    else if (this.kb && s.tray[this.kb.idx]) ghost = { pc: s.tray[this.kb.idx]!, r: this.kb.r, c: this.kb.c };
    let hiRows: number[] = [];
    let hiCols: number[] = [];
    const ghostOk = !!ghost && canPlace(s.grid, ghost.pc.shape, ghost.r, ghost.c);
    if (ghost && ghostOk) ({ rows: hiRows, cols: hiCols } = wouldClear(s.grid, ghost.pc.shape, ghost.r, ghost.c));
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 9);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const v = s.grid[r * N + c];
        if (!v) continue;
        // peças nas linhas que vão sumir ganham a cor da peça arrastada
        const hi = hiRows.includes(r) || hiCols.includes(c);
        this.tile(bx + c * u, by + r * u, u, hi && ghost ? ghost.pc.color : v);
      }
    if (ghost) {
      const a = ghostOk ? 0.42 : 0.18;
      this.drawPiece(ghost.pc, bx + ghost.c * u, by + ghost.r * u, u, a);
      if (!ghostOk && this.kb) {
        ctx.strokeStyle = '#ff5d73';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + ghost.c * u, by + ghost.r * u, ghost.pc.shape.w * u, ghost.pc.shape.h * u);
      }
    }
    if (hiRows.length || hiCols.length) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.12 * pulse})`;
      for (const r of hiRows) ctx.fillRect(bx, by + r * u, 8 * u, u);
      for (const c of hiCols) ctx.fillRect(bx + c * u, by, u, 8 * u);
    }
    // brilho de peça recém-colocada
    for (const p of this.placed) {
      const k = 1 - (this.t - p.t) / 0.3;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * k})`;
      ctx.beginPath();
      ctx.roundRect(bx + p.c * u + u * 0.06, by + p.r * u + u * 0.06, u * 0.88, u * 0.88, u * 0.18);
      ctx.fill();
    }
    // quadradinhos sumindo: clarão branco e encolhem
    for (const f of this.fading) {
      const k = (this.t - f.t) / 0.45;
      const sz = u * (1 - k * 0.85);
      const x = bx + f.c * u + (u - sz) / 2;
      const y = by + f.r * u + (u - sz) / 2;
      this.tile(x, y, sz, f.color, 1 - k * 0.6);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
      ctx.beginPath();
      ctx.roundRect(x, y, sz, sz, sz * 0.2);
      ctx.fill();
    }
    // bandeja
    for (let i = 0; i < 3; i++) {
      const sl = this.slots[i];
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.roundRect(sl.x + u * 0.08, sl.y + u * 0.08, sl.w - u * 0.16, sl.h - u * 0.16, u * 0.3);
      ctx.fill();
      const pc = s.tray[i];
      if (!pc || this.drag?.idx === i) continue;
      const fits = !s.over && hasMoveFor(s, pc);
      const born = this.born.get(pc.uid) ?? -1;
      const pop = Math.min(1, (this.t - born) / 0.25);
      const size = u * 0.52 * (0.6 + 0.4 * easeOut(pop));
      const x = sl.x + (sl.w - pc.shape.w * size) / 2;
      const y = sl.y + (sl.h - pc.shape.h * size) / 2;
      this.drawPiece(pc, x, y, size, fits ? 1 : 0.3);
      if (this.kb?.idx === i) {
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sl.x + u * 0.08, sl.y + u * 0.08, sl.w - u * 0.16, sl.h - u * 0.16, u * 0.3);
        ctx.stroke();
      }
    }
    // peça na mão (tamanho real, acima do dedo no toque)
    const d = this.drag;
    if (d && s.tray[d.idx]) {
      const pc = s.tray[d.idx]!;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = u * 0.4;
      ctx.shadowOffsetY = u * 0.15;
      this.drawPiece(pc, d.px - (pc.shape.w * u) / 2, d.py - d.lift - (pc.shape.h * u) / 2, u, 0.95);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    this.fx.draw(ctx);
    // pontos flutuando
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = (this.t - p.t) / 1.1;
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ctx.font = `800 ${Math.round(u * (p.big ? 0.62 : 0.46))}px system-ui, sans-serif`;
      ctx.lineWidth = u * 0.12;
      ctx.strokeStyle = 'rgba(10,8,30,0.85)';
      const y = p.y - k * u * 0.9;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
      ctx.globalAlpha = 1;
    }
    if (s.over) {
      ctx.fillStyle = 'rgba(8,8,24,0.45)';
      ctx.fillRect(bx, by, 8 * u, 8 * u);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(u * 0.7)}px system-ui, sans-serif`;
      ctx.fillText(T('Sem espaço!', 'No room!'), bx + 4 * u, by + 4 * u);
    }
  }

  // ---------------------------------------------------------------- QA
  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    if (!s) return null;
    return {
      score: s.score,
      over: s.over,
      streak: s.streak,
      moves: s.moves,
      lines: s.lines,
      filled: s.grid.reduce((a, v) => a + (v ? 1 : 0), 0),
      tray: s.tray.map((p) => (p ? p.shape.id : null)),
      turn: this.turn,
      scores: this.scores,
      dragging: !!this.drag,
      best: this.save.best,
    };
  }
  /** Coordenadas na tela (para o QA arrastar com o mouse de verdade). */
  geometry() {
    const r = this.cv.getBoundingClientRect();
    const u = this.u;
    return {
      u,
      slot: this.slots.map((sl) => ({ x: r.left + sl.x + sl.w / 2, y: r.top + sl.y + sl.h / 2 })),
      /** Onde soltar (com mouse) para a peça do slot `i` ficar com o canto em (row, col). */
      dropFor: (i: number, row: number, col: number) => {
        const pc = this.s!.tray[i]!;
        return { x: r.left + this.bx + (col + pc.shape.w / 2) * u, y: r.top + this.by + (row + pc.shape.h / 2) * u };
      },
    };
  }
  /** Monta uma situação para o QA: linhas da grade ('#' = cheio) e ids das peças da bandeja. */
  qaSetup(rows: string[], tray: string[]) {
    const s = this.s;
    if (!s) return;
    s.grid.fill(0);
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && (s.grid[r * N + c] = 1 + ((r + c) % 7))));
    s.tray = tray.map((id) => ({ shape: shapeById(id)!, color: 3, uid: s.nextUid++ }));
    s.over = !hasMove(s);
    this.markBorn();
    this.paintHud();
  }
}

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
function hasMoveFor(s: BlocksState, pc: Piece) {
  for (let r = 0; r <= N - pc.shape.h; r++) for (let c = 0; c <= N - pc.shape.w; c++) if (canPlace(s.grid, pc.shape, r, c)) return true;
  return false;
}

const blocks: GameModule = {
  mount(container, { onExit }) {
    const g = new BlocksGame(container, onExit);
    (window as unknown as { __blocks?: BlocksGame }).__blocks = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __blocks?: BlocksGame }).__blocks;
      },
    };
  },
};
export default blocks;
