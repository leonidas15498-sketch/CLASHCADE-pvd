import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { CHECKERS_BOARDS, equipped, type CheckersBoardPal } from '../shared/arenaThemes';
import { chooseCheckers } from './ai';
import { applyMove, CheckersState, count, createCheckers, dark, DRAW_PLIES, idx, isKing, legalMoves, Move, N, rc, Side, sideOf } from './logic';

const HELP_PT = `<ul>
<li>Toque numa peça sua (as que podem jogar brilham) e depois na casa de destino.</li>
<li>A pedra anda 1 casa na diagonal para a frente e <b>captura para a frente e para trás</b>, pulando a peça do rival.</li>
<li><b>Captura é obrigatória</b>, e vale a <b>lei da maioria</b>: se houver várias, é obrigatório a que toma mais peças. Numa captura múltipla, toque no destino final.</li>
<li>Chegou à última linha (terminando o lance lá)? Vira <b>dama</b>, que anda e captura em qualquer distância na diagonal.</li>
<li>Perde quem fica sem peças ou sem lance. Empate: ${DRAW_PLIES} lances seguidos só de damas, sem captura.</li>
</ul>`;
const HELP_EN = `<ul>
<li>Tap one of your pieces (the ones that can move glow), then the target square.</li>
<li>Men move 1 square diagonally forward and <b>capture forward and backward</b> by jumping the rival piece.</li>
<li><b>Capturing is mandatory</b> and the <b>majority rule</b> applies: you must take the sequence that captures the most pieces. In a multi-jump, tap the final square.</li>
<li>Finish a move on the far row and the man becomes a <b>king</b>, which moves and captures at any distance diagonally.</li>
<li>You lose with no pieces or no legal move. Draw: ${DRAW_PLIES} king-only moves in a row with no capture.</li>
</ul>`;

/** Tempo de cada trecho do lance (uma casa ou um pulo), em segundos. */
const STEP_T = 0.2;

interface Anim {
  m: Move;
  t: number;
  side: Side;
  value: number;
}

class CheckersGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: CheckersState | null = null;
  private cfg: StartConfig | null = null;
  private wins: [number, number] = [0, 0];
  private first: Side = 1;
  private sel = -1;
  private anim: Anim | null = null;
  private last = performance.now();
  private raf = 0;
  private aiTimer = 0;
  private thinking = false;
  private disposed = false;
  private cell = 40;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private t = 0;
  private fx = new ParticleSystem();
  private ac = new AbortController();
  private lastMove: Move | null = null;
  private resultShown = false;
  private theme = equipped('checkers.board', CHECKERS_BOARDS);

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'checkers',
      title: T('Damas', 'Checkers'),
      subtitle: T('Regras brasileiras', 'Brazilian rules'),
      modes: { ai: true, local: true },
      localNote: T('Um de cada vez, no mesmo aparelho. O coral começa embaixo.', 'Take turns on the same device. Coral starts at the bottom.'),
      musicUrl: null,
      helpHtml: T(HELP_PT, HELP_EN),
      shop: [{ slot: 'checkers.board', tabPt: 'Tabuleiro', tabEn: 'Board', items: CHECKERS_BOARDS as never, preview: (c, w, h, it) => previewBoard(c, w, h, it.pal as CheckersBoardPal), onChange: () => { this.theme = equipped('checkers.board', CHECKERS_BOARDS); } }],
      onExit,
      onStart: (cfg) => {
        this.wins = [0, 0];
        this.first = 1;
        this.start(cfg);
      },
      onPause: (p) => {
        clearTimeout(this.aiTimer);
        this.thinking = false;
        if (!p) {
          this.last = performance.now();
          if (!this.anim) this.maybeAI();
        }
      },
      onRestart: () => this.cfg && this.start(this.cfg, true),
      onMenu: () => {
        clearTimeout(this.aiTimer);
        this.s = null;
        this.anim = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Tabuleiro de damas', 'Checkers board'));
    this.cv.style.touchAction = 'none';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.cv.addEventListener('pointerdown', (e) => this.tap(e), { signal: this.ac.signal });
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.aiTimer);
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  private start(cfg: StartConfig, sameFirst = false) {
    this.shell.beginMatch();
    clearTimeout(this.aiTimer);
    this.cfg = cfg;
    if (!sameFirst) this.first = (1 - this.first) as Side;
    // o coral fica sempre embaixo; a cada partida alterna quem começa (mais justo numa sessão de várias partidas)
    this.s = createCheckers(this.first);
    this.sel = -1;
    this.anim = null;
    this.lastMove = null;
    this.thinking = false;
    this.resultShown = false;
    this.fx.clear();
    this.shell.setTurn(this.s.current);
    this.paintHud();
    this.shell.toast(`${cfg.names[this.s.current]} ${T('começa.', 'goes first.')}`, 1600);
    this.maybeAI();
  }

  private aiTurn() {
    return this.cfg?.mode === 'ai' && this.s?.current === 1 && this.s.winner === null;
  }

  private paintHud() {
    const s = this.s;
    if (!s) return this.shell.setScore('');
    const n = this.cfg!.names;
    const on = (p: Side) => s.winner === null && s.current === p;
    const left = (p: Side) => {
      const c = count(s, p);
      return c.men + c.kings;
    };
    this.shell.setScore(Shell.pill(0, n[0], left(0), on(0)) + Shell.pill(1, n[1], left(1), on(1)));
    this.shell.setSubtitle(s.winner === null ? `${T('Vez de', 'Turn:')} ${n[s.current]} · ${T('vitórias', 'wins')} ${this.wins[0]}×${this.wins[1]}` : T('Fim da partida', 'Match over'));
  }

  private movesFrom(i: number) {
    return this.s ? legalMoves(this.s).filter((m) => m.path[0] === i) : [];
  }

  private tap(e: PointerEvent) {
    const s = this.s;
    if (!s || s.winner !== null || this.anim || this.shell.paused || this.shell.overlayOpen() || this.aiTurn()) return;
    this.shell.sfx.unlock();
    const r = this.cv.getBoundingClientRect();
    const sq = this.squareAt(e.clientX - r.left, e.clientY - r.top);
    if (sq < 0) return;
    if (sideOf(s.board[sq]) === s.current) {
      const mv = this.movesFrom(sq);
      if (mv.length) {
        this.sel = sq;
        this.shell.sfx.tone(660, 0.04, 0.08, 'triangle');
      } else {
        this.sel = -1;
        const all = legalMoves(s);
        if (all[0]?.captured.length) this.shell.toast(T('Captura obrigatória: jogue com uma peça que brilha.', 'Capture is mandatory: play a glowing piece.'), 1800);
      }
      return;
    }
    if (this.sel >= 0) {
      const options = this.movesFrom(this.sel).filter((m) => m.path[m.path.length - 1] === sq);
      if (options.length) this.play(options[0]);
      else this.sel = -1;
    }
  }

  private play(m: Move) {
    const s = this.s!;
    this.sel = -1;
    this.anim = { m, t: 0, side: s.current, value: s.board[m.path[0]] };
  }

  /** O lance terminou de animar: aplica nas regras. */
  private land(a: Anim) {
    const s = this.s!;
    applyMove(s, a.m);
    this.lastMove = a.m;
    this.anim = null;
    for (const c of a.m.captured) {
      const { x, y } = this.center(c);
      this.fx.burst('confete', x, y, this.cell * 0.12);
    }
    if (a.m.captured.length) this.shell.sfx.noise(900, 0.08, 0.3, 2);
    else this.shell.sfx.tone(240, 0.06, 0.15, 'sine', 0.8);
    if (a.m.promotes) {
      this.shell.sfx.tone(880, 0.12, 0.15, 'triangle', 1.3);
      this.shell.toast(T('Virou dama! 👑', 'Crowned! 👑'), 1300);
    }
    if (s.winner !== null) return this.finish();
    this.shell.setTurn(s.current);
    this.paintHud();
    this.maybeAI();
  }

  private maybeAI() {
    if (!this.aiTurn()) return;
    this.thinking = true;
    this.paintHud();
    this.aiTimer = window.setTimeout(() => {
      if (this.disposed || !this.s || !this.aiTurn() || this.shell.paused) return;
      const m = chooseCheckers(this.s, this.cfg!.difficulty, Math.random);
      this.thinking = false;
      this.play(m);
    }, 450);
  }

  private finish() {
    const s = this.s!;
    this.shell.report(this.cfg!, s.winner as Side | 'draw');
    const n = this.cfg!.names;
    if (s.winner === 'draw') {
      this.shell.setTurn(null);
      this.shell.toast(T('Empate: muitos lances sem captura.', 'Draw: too many moves without a capture.'));
    } else {
      const w = s.winner as Side;
      this.wins[w]++;
      this.shell.setTurn(w);
      if (this.cfg!.mode === 'ai' && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
    }
    this.paintHud();
    const ai = this.cfg!.mode === 'ai';
    const w = s.winner;
    setTimeout(() => {
      if (this.disposed || this.s !== s || this.resultShown) return;
      this.resultShown = true;
      const title = w === 'draw' ? T('Empate!', 'Draw!') : ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w as Side]} ${T('venceu!', 'wins!')}`;
      this.shell.showResult(title, `${T('Placar da sessão', 'Session score')}: ${n[0]} ${this.wins[0]} × ${this.wins[1]} ${n[1]}`, () => this.start(this.cfg!));
    }, 1300);
  }

  // ---------------------------------------------------------------- laço
  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (!this.shell.paused) {
      this.fx.update(dt);
      const a = this.anim;
      if (a) {
        a.t += dt;
        if (a.t >= STEP_T * (a.m.path.length - 1)) this.land(a);
      }
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth - 12;
    const H = st.clientHeight - 10;
    this.cell = Math.max(18, Math.floor(Math.min(W, H) / (N + 0.6)));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cv.width = Math.round(st.clientWidth * this.dpr);
    this.cv.height = Math.round(st.clientHeight * this.dpr);
    this.cv.style.width = `${st.clientWidth}px`;
    this.cv.style.height = `${st.clientHeight}px`;
    this.ox = (st.clientWidth - this.cell * N) / 2;
    this.oy = (st.clientHeight - this.cell * N) / 2;
  }

  private center(i: number) {
    const [r, c] = rc(i);
    return { x: this.ox + (c + 0.5) * this.cell, y: this.oy + (r + 0.5) * this.cell };
  }

  private squareAt(x: number, y: number) {
    const c = Math.floor((x - this.ox) / this.cell);
    const r = Math.floor((y - this.oy) / this.cell);
    return r >= 0 && r < N && c >= 0 && c < N && dark(r, c) ? idx(r, c) : -1;
  }

  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const u = this.cell;
    drawBoard(ctx, this.ox, this.oy, u, this.theme.pal);
    const s = this.s;
    if (!s) {
      const demo = createCheckers();
      for (let i = 0; i < N * N; i++) if (demo.board[i]) this.piece(ctx, i, demo.board[i], 1);
      return;
    }
    // último lance
    if (this.lastMove && !this.anim) {
      ctx.fillStyle = 'rgba(255,194,74,0.28)';
      for (const i of [this.lastMove.path[0], this.lastMove.path[this.lastMove.path.length - 1]]) {
        const [r, c] = rc(i);
        ctx.fillRect(this.ox + c * u, this.oy + r * u, u, u);
      }
    }
    const moves = s.winner === null && !this.anim && !this.aiTurn() ? legalMoves(s) : [];
    const movable = new Set(moves.map((m) => m.path[0]));
    // destinos da peça escolhida (com a rota em captura múltipla)
    if (this.sel >= 0) {
      for (const m of moves.filter((x) => x.path[0] === this.sel)) {
        ctx.strokeStyle = 'rgba(40,199,183,0.7)';
        ctx.lineWidth = Math.max(2, u * 0.06);
        ctx.setLineDash([u * 0.12, u * 0.1]);
        ctx.beginPath();
        m.path.forEach((p, k) => {
          const { x, y } = this.center(p);
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        const { x, y } = this.center(m.path[m.path.length - 1]);
        ctx.fillStyle = 'rgba(40,199,183,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, u * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const a = this.anim;
    const hidden = a ? a.m.path[0] : -1;
    for (let i = 0; i < N * N; i++) {
      const v = s.board[i];
      if (!v || i === hidden) continue;
      let alpha = 1;
      if (a && a.m.captured.includes(i)) {
        // a peça capturada some quando a que pula passa por ela
        const k = a.m.captured.indexOf(i);
        alpha = a.t > STEP_T * (k + 1) ? 0.25 : 1;
      }
      this.piece(ctx, i, v, alpha, movable.has(i), i === this.sel);
    }
    if (a) {
      const seg = Math.min(a.m.path.length - 2, Math.floor(a.t / STEP_T));
      const k = Math.min(1, (a.t - seg * STEP_T) / STEP_T);
      const p0 = this.center(a.m.path[seg]);
      const p1 = this.center(a.m.path[seg + 1]);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const hop = a.m.captured.length ? Math.sin(Math.PI * k) * u * 0.25 : 0;
      drawPiece(ctx, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e - hop, u, a.value, 1, false, false, this.t);
    }
    if (this.thinking) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.round(u * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(T('IA pensando…', 'AI thinking…'), this.ox + (N * u) / 2, this.oy - u * 0.12 > 10 ? this.oy - u * 0.12 : this.oy + u * 0.4);
    }
    this.fx.draw(ctx);
  }

  private piece(ctx: CanvasRenderingContext2D, i: number, v: number, alpha: number, glow = false, picked = false) {
    const { x, y } = this.center(i);
    drawPiece(ctx, x, y, this.cell, v, alpha, glow, picked, this.t);
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s
      ? { current: s.current, winner: s.winner, sel: this.sel, anim: !!this.anim, thinking: this.thinking, legal: legalMoves(s).map((m) => m.path), pieces: [count(s, 0), count(s, 1)], wins: this.wins, cell: this.cell, ox: this.ox, oy: this.oy }
      : null;
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, u: number, pal: CheckersBoardPal) {
  const fw = u * 0.3;
  ctx.fillStyle = pal.frame;
  ctx.beginPath();
  ctx.roundRect(ox - fw, oy - fw, u * N + 2 * fw, u * N + 2 * fw, fw * 0.8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = dark(r, c) ? pal.dark : pal.light;
      ctx.fillRect(ox + c * u, oy + r * u, u, u);
    }
  // brilho suave de cima
  const g = ctx.createLinearGradient(0, oy, 0, oy + u * N);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, u * N, u * N);
}

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, v: number, alpha: number, glow: boolean, picked: boolean, t: number) {
  const side = sideOf(v)!;
  const col = PLAYER_COLORS[side];
  const r = u * 0.38;
  ctx.globalAlpha = alpha;
  if (glow || picked) {
    ctx.beginPath();
    ctx.arc(x, y, r + u * (picked ? 0.1 : 0.06 + 0.02 * Math.sin(t * 5)), 0, Math.PI * 2);
    ctx.fillStyle = picked ? 'rgba(40,199,183,0.85)' : 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
  // sombra e borda (peça "de verdade", com espessura)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.08, y + r * 0.2, r, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(col, -0.35);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, shade(col, 0.35));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(col, -0.25);
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  if (isKing(v)) {
    // coroa
    const s = r * 0.55;
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#8a5a00';
    ctx.lineWidth = Math.max(1, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.5);
    ctx.lineTo(x - s, y - s * 0.3);
    ctx.lineTo(x - s * 0.5, y + s * 0.1);
    ctx.lineTo(x, y - s * 0.6);
    ctx.lineTo(x + s * 0.5, y + s * 0.1);
    ctx.lineTo(x + s, y - s * 0.3);
    ctx.lineTo(x + s, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function previewBoard(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CheckersBoardPal) {
  ctx.fillStyle = '#0a1433';
  ctx.fillRect(0, 0, w, h);
  const u = Math.floor((h * 0.86) / N);
  const ox = (w - u * N) / 2;
  const oy = (h - u * N) / 2;
  drawBoard(ctx, ox, oy, u, pal);
  const s = createCheckers();
  for (let i = 0; i < N * N; i++)
    if (s.board[i]) {
      const [r, c] = rc(i);
      drawPiece(ctx, ox + (c + 0.5) * u, oy + (r + 0.5) * u, u, s.board[i], 1, false, false, 0);
    }
}

const checkers: GameModule = {
  mount(container, { onExit }) {
    const g = new CheckersGame(container, onExit);
    (window as unknown as { __checkers?: CheckersGame }).__checkers = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __checkers?: CheckersGame }).__checkers;
      },
    };
  },
};
export default checkers;
