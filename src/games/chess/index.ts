import { onMountRollback } from '../shared/lifecycle';
import { coinFlip } from '../shared/coin';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { CHESS_BOARDS, equipped, type CheckersBoardPal } from '../shared/arenaThemes';
import { chooseChess } from './ai';
import { applyMove, B, ChessState, createChess, idx, inCheck, K, kind, kingSquare, KN, legalMoves, Move, moveName, N, P, Q, R, rc, Side, sideOf } from './logic';

const HELP_PT = `<ul>
<li>Toque numa peça sua e depois na casa de destino (os pontos mostram os lances possíveis). O coral fica embaixo; quem começa é sorteado e alterna a cada revanche.</li>
<li>Regras oficiais: <b>roque</b> (toque no rei e depois duas casas para o lado), <b>en passant</b> e <b>promoção</b> (escolha dama, torre, bispo ou cavalo).</li>
<li>Não é permitido deixar o próprio rei em xeque. O rei em xeque fica marcado em vermelho.</li>
<li><b>Xeque-mate</b> vence. <b>Empate:</b> afogamento (sem lance e sem xeque), 50 lances sem captura nem movimento de peão, a mesma posição 3 vezes ou material insuficiente para dar mate.</li>
<li>A IA Difícil pensa até 1,5 s por lance.</li>
</ul>`;
const HELP_EN = `<ul>
<li>Tap one of your pieces, then the target square (dots show the legal moves). Coral is at the bottom; who moves first is drawn and alternates on each rematch.</li>
<li>Official rules: <b>castling</b> (tap the king, then two squares sideways), <b>en passant</b> and <b>promotion</b> (choose queen, rook, bishop or knight).</li>
<li>You may not leave your own king in check. A king in check is marked in red.</li>
<li><b>Checkmate</b> wins. <b>Draw:</b> stalemate, 50 moves without a capture or pawn move, the same position 3 times, or not enough material to mate.</li>
<li>The Hard AI thinks up to 1.5 s per move.</li>
</ul>`;

const STEP_T = 0.22;
const REASON: Record<string, [string, string]> = {
  stalemate: ['Afogamento: sem lance e sem xeque.', 'Stalemate: no legal move and no check.'],
  fifty: ['50 lances sem captura nem movimento de peão.', '50 moves without a capture or pawn move.'],
  repetition: ['A mesma posição apareceu 3 vezes.', 'The same position occurred 3 times.'],
  material: ['Material insuficiente para dar mate.', 'Not enough material to checkmate.'],
};

interface Anim {
  m: Move;
  t: number;
  value: number;
}

class ChessGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: ChessState | null = null;
  private cfg: StartConfig | null = null;
  private wins: [number, number] = [0, 0];
  private first: Side = 1;
  private sel = -1;
  /** Escolha de promoção aberta: os lances possíveis (um por peça). */
  private promo: Move[] | null = null;
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
  private lastName = '';
  private resultShown = false;
  private theme = equipped('chess.board', CHESS_BOARDS);
  /** Peças capturadas por cada lado (para o placar). */
  private taken: [number[], number[]] = [[], []];

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'chess',
      title: T('Xadrez', 'Chess'),
      subtitle: T('Regras oficiais', 'Official rules'),
      modes: { ai: true, local: true },
      localNote: T('Um de cada vez, no mesmo aparelho. Quem começa é sorteado.', 'Take turns on the same device. Who starts is drawn.'),
      musicUrl: './music/the-unwavering-line.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      shop: [{ slot: 'chess.board', tabPt: 'Tabuleiro', tabEn: 'Board', items: CHESS_BOARDS as never, preview: (c, w, h, it) => previewBoard(c, w, h, it.pal as CheckersBoardPal), onChange: () => { this.theme = equipped('chess.board', CHESS_BOARDS); } }],
      onExit,
      onStart: (cfg) => {
        this.wins = [0, 0];
        this.first = coinFlip(); // 05/11: 1ª partida sorteada (start() troca; continua 50/50), revanches alternam
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
    this.cv.setAttribute('aria-label', T('Tabuleiro de xadrez', 'Chess board'));
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
    this.s = createChess(this.first);
    this.sel = -1;
    this.promo = null;
    this.anim = null;
    this.lastMove = null;
    this.lastName = '';
    this.taken = [[], []];
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
    const pts = (p: Side) => this.taken[p].reduce((a, v) => a + ({ [P]: 1, [KN]: 3, [B]: 3, [R]: 5, [Q]: 9 }[v] ?? 0), 0);
    this.shell.setScore(Shell.pill(0, n[0], `+${pts(0)}`, on(0)) + Shell.pill(1, n[1], `+${pts(1)}`, on(1)));
    const check = s.winner === null && inCheck(s) ? T(' · XEQUE!', ' · CHECK!') : '';
    const lm = this.lastName ? ` · ${T('último', 'last')}: ${this.lastName}` : '';
    this.shell.setSubtitle(s.winner === null ? `${T('Vez de', 'Turn:')} ${n[s.current]}${check}${lm}` : T('Fim da partida', 'Match over'));
  }

  private movesFrom(i: number) {
    return this.s ? legalMoves(this.s).filter((m) => m.from === i) : [];
  }

  private tap(e: PointerEvent) {
    const s = this.s;
    if (!s || s.winner !== null || this.anim || this.shell.paused || this.shell.overlayOpen() || this.aiTurn()) return;
    this.shell.sfx.unlock();
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (this.promo) {
      const k = this.promoHit(x, y);
      const m = k >= 0 ? this.promo[k] : null;
      this.promo = null;
      if (m) this.play(m);
      return;
    }
    const sq = this.squareAt(x, y);
    if (sq < 0) return;
    if (sideOf(s.board[sq]) === s.current) {
      this.sel = this.movesFrom(sq).length ? sq : -1;
      if (this.sel < 0 && inCheck(s)) this.shell.toast(T('Você está em xeque: proteja o rei.', 'You are in check: protect your king.'), 1600);
      else this.shell.sfx.tone(660, 0.04, 0.08, 'triangle');
      return;
    }
    if (this.sel >= 0) {
      const opts = this.movesFrom(this.sel).filter((m) => m.to === sq);
      if (opts.length > 1) this.promo = [Q, R, B, KN].map((p) => opts.find((m) => m.promo === p)!);
      else if (opts.length === 1) this.play(opts[0]);
      else this.sel = -1;
    }
  }

  private play(m: Move) {
    const s = this.s!;
    this.sel = -1;
    this.lastName = moveName(s, m);
    this.anim = { m, t: 0, value: s.board[m.from] };
  }

  private land(a: Anim) {
    const s = this.s!;
    const mover = s.current;
    applyMove(s, a.m);
    this.lastMove = a.m;
    this.anim = null;
    if (a.m.captured) {
      this.taken[mover].push(kind(a.m.captured));
      const { x, y } = this.center(a.m.to);
      this.fx.burst('confete', x, y, this.cell * 0.12);
      this.shell.sfx.noise(900, 0.08, 0.3, 2);
    } else this.shell.sfx.tone(240, 0.06, 0.15, 'sine', 0.8);
    if (a.m.promo) this.shell.toast(T('Promoção! 👑', 'Promotion! 👑'), 1200);
    if (s.winner !== null) return this.finish();
    if (inCheck(s)) {
      this.shell.sfx.tone(880, 0.1, 0.15, 'square', 1.2);
      this.shell.toast(T('Xeque!', 'Check!'), 1000);
    }
    this.shell.setTurn(s.current);
    this.paintHud();
    this.maybeAI();
  }

  private maybeAI() {
    if (!this.aiTurn()) return;
    this.thinking = true;
    this.paintHud();
    // dá tempo de desenhar o "IA pensando…" antes da busca (que ocupa o processador por até 1,5 s no Difícil)
    this.aiTimer = window.setTimeout(() => {
      if (this.disposed || !this.s || !this.aiTurn() || this.shell.paused) return;
      const m = chooseChess(this.s, this.cfg!.difficulty, Math.random);
      this.thinking = false;
      this.play(m);
    }, 350);
  }

  private finish() {
    const s = this.s!;
    this.shell.report(this.cfg!, s.winner as Side | 'draw');
    const n = this.cfg!.names;
    const w = s.winner;
    let msg: string;
    if (w === 'draw') {
      this.shell.setTurn(null);
      const r = REASON[s.reason!] ?? ['', ''];
      msg = T(r[0], r[1]);
      this.shell.toast(`${T('Empate', 'Draw')}: ${msg}`, 2600);
    } else {
      this.wins[w as Side]++;
      this.shell.setTurn(w);
      msg = T('Xeque-mate!', 'Checkmate!');
      this.shell.toast(msg, 2000);
      if (this.cfg!.mode === 'ai' && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
    }
    this.paintHud();
    const ai = this.cfg!.mode === 'ai';
    setTimeout(() => {
      if (this.disposed || this.s !== s || this.resultShown) return;
      this.resultShown = true;
      const title = w === 'draw' ? T('Empate!', 'Draw!') : ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w as Side]} ${T('venceu!', 'wins!')}`;
      this.shell.showResult(title, `${msg} ${T('Placar da sessão', 'Session score')}: ${n[0]} ${this.wins[0]} × ${this.wins[1]} ${n[1]}`, () => this.start(this.cfg!));
    }, 1500);
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
        if (a.t >= STEP_T) this.land(a);
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
    return r >= 0 && r < N && c >= 0 && c < N ? idx(r, c) : -1;
  }

  /** Caixa da escolha de promoção (4 peças lado a lado, centrada no tabuleiro). */
  private promoBox() {
    const u = this.cell * 1.15;
    const w = u * 4;
    return { x: this.ox + (this.cell * N - w) / 2, y: this.oy + (this.cell * N - u) / 2, u };
  }
  private promoHit(x: number, y: number) {
    const b = this.promoBox();
    if (y < b.y || y > b.y + b.u || x < b.x || x > b.x + b.u * 4) return -1;
    return Math.floor((x - b.x) / b.u);
  }

  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const u = this.cell;
    drawBoard(ctx, this.ox, this.oy, u, this.theme.pal);
    const s = this.s ?? createChess();
    if (this.s && this.lastMove && !this.anim) {
      ctx.fillStyle = 'rgba(255,194,74,0.32)';
      for (const i of [this.lastMove.from, this.lastMove.to]) {
        const [r, c] = rc(i);
        ctx.fillRect(this.ox + c * u, this.oy + r * u, u, u);
      }
    }
    if (this.s && this.s.winner === null && !this.anim && inCheck(s)) {
      const { x, y } = this.center(kingSquare(s.board, s.current));
      const g = ctx.createRadialGradient(x, y, u * 0.1, x, y, u * 0.7);
      g.addColorStop(0, 'rgba(255,40,60,0.85)');
      g.addColorStop(1, 'rgba(255,40,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - u / 2, y - u / 2, u, u);
    }
    if (this.sel >= 0) {
      const [r, c] = rc(this.sel);
      ctx.fillStyle = 'rgba(40,199,183,0.45)';
      ctx.fillRect(this.ox + c * u, this.oy + r * u, u, u);
    }
    const a = this.anim;
    for (let i = 0; i < 64; i++) {
      const v = s.board[i];
      if (!v || (a && (i === a.m.from || (a.m.castle && i === rookFrom(a.m))))) continue;
      if (a && i === a.m.to) continue; // a peça capturada some quando a outra chega
      const { x, y } = this.center(i);
      drawPiece(ctx, x, y, u, v);
    }
    if (a) {
      const k = Math.min(1, a.t / STEP_T);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const lerp = (from: number, to: number, v: number) => {
        const p0 = this.center(from);
        const p1 = this.center(to);
        drawPiece(ctx, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e - Math.sin(Math.PI * k) * u * 0.12, u, v);
      };
      if (a.m.captured && !a.m.ep && k < 0.85) {
        const { x, y } = this.center(a.m.to);
        ctx.globalAlpha = 1 - k;
        drawPiece(ctx, x, y, u, s.board[a.m.to]);
        ctx.globalAlpha = 1;
      }
      if (a.m.castle) {
        const rf = rookFrom(a.m);
        lerp(rf, a.m.castle === 'K' ? rf - 2 : rf + 3, s.board[rf]);
      }
      lerp(a.m.from, a.m.to, a.value);
    }
    // destinos possíveis
    if (this.sel >= 0 && this.s && !this.promo) {
      for (const m of this.movesFrom(this.sel)) {
        const { x, y } = this.center(m.to);
        ctx.fillStyle = 'rgba(40,199,183,0.85)';
        ctx.strokeStyle = 'rgba(40,199,183,0.9)';
        ctx.lineWidth = Math.max(2, u * 0.07);
        ctx.beginPath();
        if (m.captured) {
          ctx.arc(x, y, u * 0.44, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.arc(x, y, u * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // coordenadas
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${Math.round(u * 0.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 8; c++) ctx.fillText('abcdefgh'[c], this.ox + (c + 0.5) * u, this.oy + 8 * u + u * 0.15);
    for (let r = 0; r < 8; r++) ctx.fillText(String(8 - r), this.ox - u * 0.15, this.oy + (r + 0.5) * u);
    if (this.promo) {
      const b = this.promoBox();
      ctx.fillStyle = 'rgba(8,12,30,0.92)';
      ctx.strokeStyle = '#ffc24a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(b.x - 6, b.y - 28, b.u * 4 + 12, b.u + 34, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(Math.max(12, u * 0.26))}px system-ui, sans-serif`;
      ctx.fillText(T('Promover para:', 'Promote to:'), b.x + b.u * 2, b.y - 13);
      const sgn = s.current === 0 ? 1 : -1;
      [Q, R, B, KN].forEach((p, k) => drawPiece(ctx, b.x + (k + 0.5) * b.u, b.y + b.u / 2, b.u, sgn * p));
    }
    if (this.thinking) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.round(u * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(T('IA pensando…', 'AI thinking…'), this.ox + (N * u) / 2, this.oy - u * 0.25 > 10 ? this.oy - u * 0.25 : this.oy + u * 0.4);
    }
    this.fx.draw(ctx);
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s
      ? { moves: legalMoves(s).map((m) => [m.from, m.to]), current: s.current, winner: s.winner, reason: s.reason, sel: this.sel, promo: !!this.promo, anim: !!this.anim, thinking: this.thinking, check: inCheck(s), legal: legalMoves(s).length, plies: s.plies, cell: this.cell, ox: this.ox, oy: this.oy, wins: this.wins }
      : null;
  }
}

const rookFrom = (m: Move) => (m.castle === 'K' ? m.from + 3 : m.from - 4);

function drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, u: number, pal: CheckersBoardPal) {
  const fw = u * 0.32;
  ctx.fillStyle = pal.frame;
  ctx.beginPath();
  ctx.roundRect(ox - fw, oy - fw, u * N + 2 * fw, u * N + 2 * fw, fw * 0.8);
  ctx.fill();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? pal.dark : pal.light;
      ctx.fillRect(ox + c * u, oy + r * u, u, u);
    }
  const g = ctx.createLinearGradient(0, oy, 0, oy + u * N);
  g.addColorStop(0, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, u * N, u * N);
}

/** Silhuetas das peças numa caixa de 100×100 (centro em 0,0). Desenhadas pelo próprio jogo, sem fonte/emoji. */
const SHAPES: Record<number, string> = {
  [P]: 'M-14 30 L-9 4 Q-16 -2 -10 -10 A13 13 0 1 1 10 -10 Q16 -2 9 4 L14 30 Z',
  [R]: 'M-18 30 L-15 -14 L-22 -16 L-22 -36 L-13 -36 L-13 -28 L-4 -28 L-4 -36 L4 -36 L4 -28 L13 -28 L13 -36 L22 -36 L22 -16 L15 -14 L18 30 Z',
  [KN]: 'M-20 30 L-16 6 Q-22 -2 -18 -10 L-2 -28 L0 -38 L6 -30 Q22 -24 24 -2 L26 30 Z M-18 -10 Q-26 2 -18 8 L-6 0 Z',
  [B]: 'M-16 30 L-8 6 Q-20 -6 -10 -22 L0 -34 L10 -22 Q20 -6 8 6 L16 30 Z',
  [Q]: 'M-22 30 L-17 2 L-28 -24 L-12 -6 L-8 -32 L0 -8 L8 -32 L12 -6 L28 -24 L17 2 L22 30 Z',
  [K]: 'M-22 30 L-18 0 Q-28 -14 -14 -20 L-4 -18 L-4 -26 L-11 -26 L-11 -32 L-4 -32 L-4 -40 L4 -40 L4 -32 L11 -32 L11 -26 L4 -26 L4 -18 L14 -20 Q28 -14 18 0 L22 30 Z',
};
const PATHS = new Map<number, Path2D>();
const shape = (t: number) => {
  let p = PATHS.get(t);
  if (!p) {
    p = new Path2D(SHAPES[t]);
    PATHS.set(t, p);
  }
  return p;
};

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, v: number) {
  const side = sideOf(v)!;
  const t = kind(v);
  const col = PLAYER_COLORS[side];
  const k = (u * 0.84) / 100;
  ctx.save();
  ctx.translate(x, y + u * 0.02);
  ctx.scale(k, k);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 38, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // base
  const base = new Path2D('M-28 30 H28 Q32 30 32 35 V40 Q32 44 28 44 H-28 Q-32 44 -32 40 V35 Q-32 30 -28 30 Z');
  const g = ctx.createLinearGradient(-30, -40, 30, 40);
  g.addColorStop(0, shade(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, -0.35));
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(col, -0.62);
  ctx.stroke(base);
  ctx.stroke(shape(t));
  ctx.fillStyle = g;
  ctx.fill(base);
  ctx.fill(shape(t), 'nonzero');
  // detalhes
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(col, -0.5);
  if (t === KN) {
    ctx.fillStyle = shade(col, -0.62);
    ctx.beginPath();
    ctx.arc(6, -16, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (t === B) {
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(5, -24);
    ctx.stroke();
  } else if (t === Q || t === K) {
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(16, 8);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-8, -6, 4, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function previewBoard(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CheckersBoardPal) {
  ctx.fillStyle = '#0a1433';
  ctx.fillRect(0, 0, w, h);
  const u = Math.floor((h * 0.86) / N);
  const ox = (w - u * N) / 2;
  const oy = (h - u * N) / 2;
  drawBoard(ctx, ox, oy, u, pal);
  const s = createChess();
  for (let i = 0; i < 64; i++)
    if (s.board[i]) {
      const [r, c] = rc(i);
      drawPiece(ctx, ox + (c + 0.5) * u, oy + (r + 0.5) * u, u, s.board[i]);
    }
}

const chess: GameModule = {
  mount(container, { onExit }) {
    const g = new ChessGame(container, onExit);
    (window as unknown as { __chess?: ChessGame }).__chess = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __chess?: ChessGame }).__chess;
      },
    };
  },
};
export default chess;
