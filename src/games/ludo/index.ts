import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { chooseLudo } from './ai';
import { cellOf, createLudo, FINISH, LudoState, moveToken, movable, roll, SAFE, SEATS, TRACK, TOKENS } from './logic';

const HELP_PT = `<ul>
<li>Toque no <b>dado</b> para rolar. Depois toque no peão que quer mover (os que podem andar pulsam). Se só um pode, ele anda sozinho.</li>
<li>Só sai da base tirando <b>6</b>. Tirou 6, capturou ou levou um peão ao centro: <b>joga de novo</b>. Três 6 seguidos: perde a vez.</li>
<li>Parou na casa de um peão rival? Ele volta para a base. Nas casas com ★ e nas saídas ninguém é capturado.</li>
<li>Depois de dar a volta, o peão entra no corredor da sua cor. Para chegar ao centro precisa do número exato.</li>
<li>Vence quem levar os 4 peões ao centro.</li>
</ul>`;
const HELP_EN = `<ul>
<li>Tap the <b>die</b> to roll, then tap the pawn you want to move (pawns that can move pulse). If only one can, it moves by itself.</li>
<li>A pawn leaves the base only on a <b>6</b>. Rolling 6, capturing or bringing a pawn home gives you <b>another roll</b>. Three 6s in a row: you lose the turn.</li>
<li>Land on a rival pawn and it goes back to base. Squares with ★ and the start squares are safe.</li>
<li>After a full lap the pawn enters your colored lane. You need the exact number to reach the center.</li>
<li>First to bring all 4 pawns to the center wins.</li>
</ul>`;

/** Cores dos assentos (0 e 1 = padrão da plataforma; 2 e 3 para o futuro 4P). */
const SEAT_COLORS = [PLAYER_COLORS[0], PLAYER_COLORS[1], '#ffc24a', '#28c7b7'];
const STEP_T = 0.11;
const ROLL_T = 0.6;

interface Walk {
  player: number;
  token: number;
  from: number;
  to: number;
  t: number;
}

class LudoGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: LudoState | null = null;
  private cfg: StartConfig | null = null;
  private wins: [number, number] = [0, 0];
  private first = 1;
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private dpr = 1;
  private u = 20;
  private ox = 0;
  private oy = 0;
  private dice = { x: 0, y: 0, size: 60 };
  private rolling = 0;
  private rollShown = 1;
  private walk: Walk | null = null;
  private pending: (() => void) | null = null;
  private aiTimer = 0;
  private disposed = false;
  private fx = new ParticleSystem();
  private ac = new AbortController();
  private resultShown = false;
  private msg = '';

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'ludo',
      title: 'Ludo',
      subtitle: T('Dado, sorte e estratégia', 'Dice, luck and strategy'),
      modes: { ai: true, local: true },
      localNote: T('2 jogadores no mesmo aparelho (4 jogadores em breve).', '2 players on one device (4 players coming soon).'),
      musicUrl: null,
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => {
        this.wins = [0, 0];
        this.first = 1;
        this.start(cfg);
      },
      onPause: (p) => {
        clearTimeout(this.aiTimer);
        if (!p) {
          this.last = performance.now();
          this.maybeAI();
        }
      },
      onRestart: () => this.cfg && this.start(this.cfg, true),
      onMenu: () => {
        clearTimeout(this.aiTimer);
        this.s = null;
        this.walk = null;
        this.pending = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Tabuleiro de Ludo', 'Ludo board'));
    this.cv.style.touchAction = 'none';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.cv.addEventListener('pointerdown', (e) => this.tap(e), { signal: this.ac.signal });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') this.tryRoll();
    }, { signal: this.ac.signal });
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
    if (!sameFirst) this.first = 1 - this.first;
    this.s = createLudo(2, this.first);
    this.walk = null;
    this.pending = null;
    this.rolling = 0;
    this.resultShown = false;
    this.fx.clear();
    this.msg = '';
    this.shell.setTurn(this.s.current as 0 | 1);
    this.paintHud();
    this.shell.toast(`${cfg.names[this.s.current]} ${T('começa. Toque no dado!', 'goes first. Tap the die!')}`, 1800);
    this.maybeAI();
  }

  private aiTurn() {
    return this.cfg?.mode === 'ai' && this.s?.current === 1 && this.s.winner === null;
  }
  private busy() {
    return !!this.walk || this.rolling > 0 || !!this.pending;
  }

  private paintHud() {
    const s = this.s;
    if (!s) return this.shell.setScore('');
    const n = this.cfg!.names;
    const home = (p: number) => s.pos[p].filter((x) => x === FINISH).length;
    const on = (p: 0 | 1) => s.winner === null && s.current === p;
    this.shell.setScore(Shell.pill(0, n[0], `${home(0)}/4`, on(0)) + Shell.pill(1, n[1], `${home(1)}/4`, on(1)));
    this.shell.setSubtitle(s.winner === null ? `${T('Vez de', 'Turn:')} ${n[s.current]} · ${T('vitórias', 'wins')} ${this.wins[0]}×${this.wins[1]}` : T('Fim da partida', 'Match over'));
  }

  // ------------------------------------------------------------ jogadas
  private tryRoll() {
    const s = this.s;
    if (!s || s.winner !== null || s.dice !== null || this.busy() || this.shell.paused || this.shell.overlayOpen() || this.aiTurn()) return;
    this.doRoll();
  }

  private doRoll() {
    const s = this.s!;
    this.shell.sfx.unlock();
    this.rolling = ROLL_T;
    this.shell.sfx.noise(2400, 0.25, 0.18, 1.5);
    const value = 1 + Math.floor(Math.random() * 6);
    const who = s.current;
    this.pending = () => {
      this.pending = null;
      this.rollShown = value;
      const r = roll(s, value);
      const name = this.cfg!.names[who];
      if (r === 'forfeit') this.say(T(`${name}: três 6 seguidos, perdeu a vez.`, `${name}: three 6s in a row, turn lost.`));
      else if (r === 'pass') this.say(value === 6 ? T('Sem jogada com 6. Role de novo!', 'No move with a 6. Roll again!') : T(`${name} tirou ${value}: nenhum peão pode andar.`, `${name} rolled ${value}: no pawn can move.`));
      else {
        const opts = movable(s);
        if (opts.length === 1 || (this.aiTurn())) {
          // só um peão pode andar (ou é a IA): anda sozinho depois de mostrar o dado
          this.aiTimer = window.setTimeout(() => this.chooseAndMove(), this.aiTurn() ? 450 : 300);
          return;
        }
        this.say(T('Escolha o peão.', 'Pick a pawn.'));
      }
      this.afterTurn();
    };
  }

  private chooseAndMove() {
    const s = this.s;
    if (!s || this.disposed || s.dice === null) return;
    const opts = movable(s);
    const tok = this.aiTurn() ? chooseLudo(s, this.cfg!.difficulty, Math.random) : opts[0];
    this.move(tok);
  }

  private move(token: number) {
    const s = this.s!;
    const me = s.current;
    const from = s.pos[me][token];
    const before = s.pos.map((p) => p.slice());
    const r = moveToken(s, token);
    const to = s.pos[me][token];
    // desfaz a captura só no desenho até o peão chegar (aplicada nas regras já)
    const captured = r.captured;
    this.walk = { player: me, token, from, to, t: 0 };
    this.pending = () => {
      this.pending = null;
      this.walk = null;
      if (captured.length) {
        for (const c of captured) {
          const [rr, cc] = cellOfPos(before[c.player][c.token], s.seatOf[c.player], c.token);
          this.fx.burst('confete', this.ox + (cc + 0.5) * this.u, this.oy + (rr + 0.5) * this.u, this.u * 0.08);
        }
        this.shell.sfx.noise(700, 0.1, 0.35, 2);
        this.say(T('Captura! Joga de novo.', 'Capture! Roll again.'));
      } else if (r.finished) {
        this.shell.sfx.tone(880, 0.12, 0.15, 'triangle', 1.3);
        this.say(T('Chegou ao centro! Joga de novo.', 'Home! Roll again.'));
      } else if (r.again) this.say(T('Tirou 6: joga de novo.', 'Rolled 6: roll again.'));
      else this.msg = '';
      this.afterTurn();
    };
    this.capturedDraw = captured.map((c) => ({ ...c, pos: before[c.player][c.token] }));
  }
  /** Peões capturados continuam desenhados no lugar até o peão que captura chegar. */
  private capturedDraw: Array<{ player: number; token: number; pos: number }> = [];

  private afterTurn() {
    const s = this.s!;
    this.capturedDraw = [];
    // a vez passou: o aviso era do jogador anterior
    if (this.msgOwner !== s.current) this.msg = '';
    this.paintHud();
    if (s.winner !== null) return this.finish();
    this.shell.setTurn(s.current as 0 | 1);
    this.maybeAI();
  }

  private msgOwner = 0;
  private say(m: string) {
    this.msg = m;
    this.msgOwner = this.s?.current ?? 0;
  }

  private maybeAI() {
    const s = this.s;
    if (!s || !this.aiTurn() || this.busy() || s.dice !== null || this.shell.paused) return;
    clearTimeout(this.aiTimer);
    this.aiTimer = window.setTimeout(() => {
      if (this.disposed || !this.aiTurn() || this.busy() || this.shell.paused) return;
      this.doRoll();
    }, 650);
  }

  private tap(e: PointerEvent) {
    const s = this.s;
    if (!s || s.winner !== null || this.shell.paused || this.shell.overlayOpen() || this.aiTurn()) return;
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (s.dice === null) {
      // rolar: toque em qualquer lugar (o dado brilha quando é a sua vez)
      this.tryRoll();
      return;
    }
    if (this.busy()) return;
    // escolher peão: o mais perto do toque entre os que podem andar
    let best = -1;
    let bestD = this.u * 1.1;
    for (const t of movable(s)) {
      const [rr, cc] = cellOf(s, s.current, t);
      const dd = Math.hypot(x - (this.ox + (cc + 0.5) * this.u), y - (this.oy + (rr + 0.5) * this.u));
      if (dd < bestD) {
        bestD = dd;
        best = t;
      }
    }
    if (best >= 0) this.move(best);
  }

  private finish() {
    const s = this.s!;
    const w = s.winner as 0 | 1;
    this.shell.report(this.cfg!, w);
    this.wins[w]++;
    this.shell.setTurn(w);
    if (this.cfg!.mode === 'ai' && w === 1) this.shell.sfx.lose();
    else this.shell.sfx.win();
    this.fx.burst('confete', this.ox + 7.5 * this.u, this.oy + 7.5 * this.u, this.u * 0.2);
    this.paintHud();
    const n = this.cfg!.names;
    const ai = this.cfg!.mode === 'ai';
    setTimeout(() => {
      if (this.disposed || this.s !== s || this.resultShown) return;
      this.resultShown = true;
      const title = ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`;
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
      if (this.rolling > 0) {
        this.rolling -= dt;
        this.rollShown = 1 + Math.floor((this.t * 17) % 6);
        if (this.rolling <= 0) {
          this.rolling = 0;
          this.pending?.();
        }
      } else if (this.walk) {
        const w = this.walk;
        w.t += dt;
        const steps = w.from < 0 ? 1 : w.to - w.from;
        if (w.t >= steps * STEP_T + 0.05) this.pending?.();
        else if (Math.floor(w.t / STEP_T) !== Math.floor((w.t - dt) / STEP_T)) this.shell.sfx.tone(520 + 30 * Math.floor(w.t / STEP_T), 0.03, 0.06, 'triangle');
      }
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth;
    const H = st.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cv.width = Math.round(W * this.dpr);
    this.cv.height = Math.round(H * this.dpr);
    this.cv.style.width = `${W}px`;
    this.cv.style.height = `${H}px`;
    const wide = W > H * 1.25;
    const B = wide ? Math.min(H - 10, W - Math.min(220, W * 0.32)) : Math.min(W - 10, H - Math.min(150, H * 0.24));
    this.u = Math.max(10, Math.floor(B / 15));
    const bs = this.u * 15;
    if (wide) {
      const panel = W - bs;
      this.ox = Math.round((W - bs - panel * 0.9) / 2 + panel * 0.05);
      this.oy = Math.round((H - bs) / 2);
      this.dice = { x: this.ox + bs + (W - this.ox - bs) / 2, y: H / 2, size: Math.min(70, (W - this.ox - bs) * 0.45) };
    } else {
      this.ox = Math.round((W - bs) / 2);
      this.oy = 6;
      this.dice = { x: W / 2, y: this.oy + bs + (H - this.oy - bs) / 2, size: Math.min(64, (H - this.oy - bs) * 0.55) };
    }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBoard(ctx, this.ox, this.oy, this.u, 2);
    const s = this.s;
    if (!s) return;
    const opts = s.dice !== null && !this.busy() && !this.aiTurn() ? new Set(movable(s)) : new Set<number>();
    // peões (os da vez por cima)
    const order = [...Array(s.players).keys()].sort((a) => (a === s.current ? 1 : -1));
    for (const p of order)
      for (let tk = 0; tk < TOKENS; tk++) {
        let rc = cellOf(s, p, tk);
        const w = this.walk;
        let hop = 0;
        if (w && w.player === p && w.token === tk) {
          const steps = w.from < 0 ? 1 : w.to - w.from;
          const k = Math.min(steps, w.t / STEP_T);
          const i = Math.floor(k);
          const f = k - i;
          const a = w.from < 0 ? (i === 0 ? w.from : w.to) : w.from + i;
          const b = w.from < 0 ? w.to : Math.min(w.to, w.from + i + 1);
          const ca = cellOfPos(a, s.seatOf[p], tk);
          const cb = cellOfPos(b, s.seatOf[p], tk);
          rc = [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f];
          hop = Math.sin(Math.PI * f) * this.u * 0.35;
        }
        const cap = this.capturedDraw.find((c) => c.player === p && c.token === tk);
        if (cap) rc = cellOfPos(cap.pos, s.seatOf[p], tk);
        if (s.pos[p][tk] === FINISH && !(w && w.player === p && w.token === tk)) {
          // no centro: arruma em leque no triângulo da cor
          const seat = s.seatOf[p];
          const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]][seat];
          rc = [7 + dirs[0] * 0.55 + (tk - 1.5) * 0.18 * Math.abs(dirs[1]), 7 + dirs[1] * 0.55 + (tk - 1.5) * 0.18 * Math.abs(dirs[0])];
        }
        const glow = p === s.current && opts.has(tk);
        drawPawn(ctx, this.ox + (rc[1] + 0.5) * this.u, this.oy + (rc[0] + 0.5) * this.u - hop, this.u, SEAT_COLORS[s.seatOf[p]], glow ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0, s.pos[p][tk] === FINISH ? 0.7 : 1);
      }
    this.fx.draw(ctx);
    // dado
    const d = this.dice;
    const myTurn = s.winner === null && s.dice === null && !this.busy() && !this.aiTurn();
    drawDie(ctx, d.x, d.y, d.size, this.rolling > 0 ? this.rollShown : s.dice ?? this.rollShown, SEAT_COLORS[s.seatOf[s.current]], myTurn ? 0.5 + 0.5 * Math.sin(this.t * 5) : 0, this.rolling > 0 ? this.t * 14 : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(12, Math.round(d.size * 0.2))}px system-ui, sans-serif`;
    const choosing = s.winner === null && s.dice !== null && !this.busy() && !this.aiTurn();
    const label = s.winner !== null ? '' : this.aiTurn() ? T('IA jogando…', 'AI playing…') : myTurn ? (this.msg ? `${this.msg} ${T('Toque para rolar.', 'Tap to roll.')}` : T('Toque para rolar', 'Tap to roll')) : choosing ? T('Escolha o peão que brilha.', 'Pick a glowing pawn.') : this.msg;
    wrapText(ctx, label, d.x, d.y + d.size * 0.85, Math.max(110, d.size * 2.4), Math.max(14, d.size * 0.24));
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s ? { current: s.current, dice: s.dice, winner: s.winner, pos: s.pos.map((p) => p.slice()), movable: movable(s), busy: this.busy(), wins: this.wins, dieX: this.dice.x, dieY: this.dice.y, u: this.u, ox: this.ox, oy: this.oy } : null;
  }
  /** Para QA: célula [linha, coluna] de um peão. */
  tokenCell(player: number, token: number) {
    return this.s ? cellOf(this.s, player, token) : null;
  }
  /** Para QA: rola um valor escolhido (só fora da vez da IA). */
  forceRoll(v: number) {
    const s = this.s;
    if (!s || this.busy() || s.dice !== null) return 'busy';
    this.rollShown = v;
    const r = roll(s, v);
    if (r !== 'choose') this.afterTurn();
    return r;
  }
}

/** Célula de uma posição qualquer de um peão de um assento (para animar passo a passo). */
function cellOfPos(p: number, seat: number, token: number): [number, number] {
  const st = SEATS[seat];
  if (p < 0) return [st.base[0] + 1.5 + (token >> 1) * 3, st.base[1] + 1.5 + (token & 1) * 3];
  if (p <= 50) return TRACK[(st.start + p) % 52];
  if (p < FINISH) return st.home[p - 51];
  return [7, 7];
}

function drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, u: number, players: number) {
  const B = u * 15;
  ctx.fillStyle = '#0d1530';
  ctx.beginPath();
  ctx.roundRect(ox - u * 0.25, oy - u * 0.25, B + u * 0.5, B + u * 0.5, u * 0.5);
  ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(ox, oy, B, B);
  const cell = (r: number, c: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + c * u, oy + r * u, u, u);
  };
  // bases
  SEATS.forEach((st, i) => {
    const col = i < players ? SEAT_COLORS[i] : '#9aa3b8';
    const [br, bc] = st.base;
    ctx.fillStyle = col;
    ctx.fillRect(ox + bc * u, oy + br * u, 6 * u, 6 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(ox + (bc + 0.8) * u, oy + (br + 0.8) * u, 4.4 * u, 4.4 * u, u * 0.6);
    ctx.fill();
    for (let t = 0; t < 4; t++) {
      ctx.beginPath();
      ctx.arc(ox + (bc + 2 + (t & 1) * 3) * u, oy + (br + 2 + (t >> 1) * 3) * u, u * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = i < players ? shadeA(col, 0.35) : 'rgba(150,160,180,0.35)';
      ctx.fill();
    }
    // corredor e saída
    for (const [r, c] of st.home) cell(r, c, i < players ? col : '#c9ced9');
    const [sr, sc] = TRACK[st.start];
    cell(sr, sc, i < players ? col : '#c9ced9');
  });
  // grade das casas
  ctx.strokeStyle = 'rgba(20,25,45,0.35)';
  ctx.lineWidth = 1;
  for (const [r, c] of TRACK) ctx.strokeRect(ox + c * u + 0.5, oy + r * u + 0.5, u - 1, u - 1);
  for (const st of SEATS) for (const [r, c] of st.home) ctx.strokeRect(ox + c * u + 0.5, oy + r * u + 0.5, u - 1, u - 1);
  // estrelas (casas seguras que não são saídas)
  for (const i of SAFE) {
    if (SEATS.some((st) => st.start === i)) continue;
    const [r, c] = TRACK[i];
    star(ctx, ox + (c + 0.5) * u, oy + (r + 0.5) * u, u * 0.32, '#9aa3b8');
  }
  // centro: 4 triângulos
  const cx = ox + 7.5 * u;
  const cy = oy + 7.5 * u;
  const tri = (ax: number, ay: number, bx: number, by: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const x0 = ox + 6 * u;
  const x1 = ox + 9 * u;
  const y0 = oy + 6 * u;
  const y1 = oy + 9 * u;
  const colOf = (i: number) => (i < players ? SEAT_COLORS[i] : '#c9ced9');
  tri(x0, y1, x1, y1, colOf(0)); // embaixo
  tri(x0, y0, x1, y0, colOf(1)); // em cima
  tri(x0, y0, x0, y1, colOf(2)); // esquerda
  tri(x1, y0, x1, y1, colOf(3)); // direita
  ctx.strokeStyle = 'rgba(20,25,45,0.5)';
  ctx.strokeRect(x0, y0, 3 * u, 3 * u);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawPawn(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, color: string, glow: number, scale: number) {
  const s = u * 0.56 * scale;
  if (glow > 0) {
    ctx.beginPath();
    ctx.arc(x, y, s * (1.25 + 0.2 * glow), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * glow})`;
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.8, s * 0.85, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // base + corpo + cabeça (peão de verdade, visto de frente)
  const g = ctx.createLinearGradient(x - s, 0, x + s, 0);
  g.addColorStop(0, shadeA(color, 0.35));
  g.addColorStop(1, shadeA(color, -0.3));
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(15,10,30,0.7)';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y + s * 0.75);
  ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.35, x - s * 0.3, y + s * 0.2);
  ctx.lineTo(x - s * 0.22, y - s * 0.25);
  ctx.lineTo(x + s * 0.22, y - s * 0.25);
  ctx.lineTo(x + s * 0.3, y + s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.35, x + s * 0.8, y + s * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - s * 0.5, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x - s * 0.14, y - s * 0.64, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, color: string, glow: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(spin) * 0.35);
  const h = size / 2;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + 14 * glow;
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-h, -h, size, size, size * 0.2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = color;
  ctx.stroke();
  const pips: Record<number, Array<[number, number]>> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  ctx.fillStyle = '#1b1426';
  for (const [px, py] of pips[v] ?? pips[1]) {
    ctx.beginPath();
    ctx.arc(px * size * 0.26, py * size * 0.26, size * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  if (!text) return;
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

function shadeA(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const ludo: GameModule = {
  mount(container, { onExit }) {
    const g = new LudoGame(container, onExit);
    (window as unknown as { __ludo?: LudoGame }).__ludo = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __ludo?: LudoGame }).__ludo;
      },
    };
  },
};
export default ludo;
