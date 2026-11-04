import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { createStore } from '../../services/storage';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { thinkSnake } from './ai';
import { addRound, createSnakeGame, Dir, DX, DY, GRID, MatchScore, ROUNDS_TO_WIN, SnakeState, step, stepsPerSecond, turn, WIN_LEN, xy } from './logic';

const HELP_PT = `<ul>
<li><b>Controle:</b> deslize o dedo para a direção em que quer virar. Dá para encadear curvas sem tirar o dedo. Teclado: setas ou W A S D.</li>
<li>Coma as frutas para crescer. Bater na parede, no seu corpo ou no corpo do rival acaba com a cobra.</li>
<li><b>Solo:</b> faça o máximo de frutas. A cobra acelera a cada fruta.</li>
<li><b>Duelo (contra a IA ou 2 jogadores):</b> vence a rodada quem sobreviver ou quem chegar primeiro a <b>${WIN_LEN}</b> pedaços. Quem vencer <b>${ROUNDS_TO_WIN}</b> rodadas leva a partida. Batida de frente = rodada empatada.</li>
<li><b>2 jogadores:</b> o Jogador 1 (coral) desliza na metade esquerda da tela; o Jogador 2 (azul), na direita. Teclado: W A S D e setas.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Control:</b> swipe toward the direction you want to turn. You can chain turns without lifting your finger. Keyboard: arrows or W A S D.</li>
<li>Eat fruit to grow. Hitting a wall, your own body or the rival's body ends your snake.</li>
<li><b>Solo:</b> eat as much fruit as you can. The snake speeds up with each fruit.</li>
<li><b>Duel (vs AI or 2 players):</b> you win the round by surviving or by reaching <b>${WIN_LEN}</b> segments first. First to <b>${ROUNDS_TO_WIN}</b> rounds wins. Head-on crash = tied round.</li>
<li><b>2 players:</b> Player 1 (coral) swipes on the left half of the screen; Player 2 (blue) on the right. Keyboard: W A S D and arrows.</li>
</ul>`;

const KEYS: Record<string, [0 | 1, Dir]> = { w: [0, 0], d: [0, 1], s: [0, 2], a: [0, 3], arrowup: [1, 0], arrowright: [1, 1], arrowdown: [1, 2], arrowleft: [1, 3] };

interface Save {
  best: number;
}
const store = createStore<Save>('clashcade.snake.v1', 1, () => ({ best: 0 }), (x): x is Save => !!x && Number.isFinite((x as Save).best) && (x as Save).best >= 0);

class SnakeGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: StartConfig | null = null;
  private s: SnakeState | null = null;
  private match: MatchScore = { rounds: [0, 0], winner: null };
  private raf = 0;
  private last = 0;
  private acc = 0;
  private roundT = 0;
  private countdown = 0;
  private after = 0;
  private cell = 20;
  private dpr = 1;
  private disposed = false;
  private fx = new ParticleSystem();
  private swipe = new Map<number, { x: number; y: number; who: 0 | 1 }>();
  private ac = new AbortController();
  private t = 0;
  private roundNo = 0;
  private save = store.load();
  private newRecord = false;

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'snake',
      title: T('Cobrinha', 'Snake'),
      subtitle: T('Coma, cresça e não bata', "Eat, grow, don't crash"),
      modes: { solo: T('Jogar sozinho', 'Play solo'), ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo: cada um desliza na sua metade da tela.', 'Both play at once: each swipes on their own half of the screen.'),
      musicUrl: null,
      helpHtml: T(HELP_PT, HELP_EN),
      menuNote: () => (this.save.best ? `${T('Seu recorde', 'Your record')}: ${this.save.best} ${T('frutas', 'fruits')}` : T('Sem recorde ainda.', 'No record yet.')),
      onExit,
      onStart: (cfg) => this.start(cfg),
      onPause: (p) => {
        this.swipe.clear();
        if (!p) this.last = performance.now();
      },
      onRestart: () => this.cfg && this.start(this.cfg),
      onMenu: () => {
        this.s = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Arena da Cobrinha', 'Snake arena'));
    this.cv.style.touchAction = 'none';
    this.cv.style.borderRadius = '14px';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.bindInput();
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  private get solo() {
    return this.cfg?.mode === 'solo';
  }

  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.match = { rounds: [0, 0], winner: null };
    this.roundNo = 0;
    this.newRecord = false;
    this.newRound();
  }

  private newRound() {
    this.roundNo++;
    this.s = createSnakeGame(this.solo ? 1 : 2);
    this.acc = 0;
    this.roundT = 0;
    this.countdown = 2.4;
    this.after = 0;
    this.fx.clear();
    this.swipe.clear();
    this.shell.setTurn(this.solo ? 0 : null);
    this.paintHud();
    this.shell.toast(this.roundNo === 1 ? T('Deslize para virar. Coma as frutas!', 'Swipe to turn. Eat the fruit!') : `${T('Rodada', 'Round')} ${this.roundNo}`, 1800);
  }

  private paintHud() {
    const s = this.s;
    const n = this.cfg?.names ?? ['', ''];
    if (!s) return this.shell.setScore('');
    if (this.solo) {
      this.shell.setScore(Shell.pill(0, n[0], s.snakes[0].eaten, true));
      this.shell.setSubtitle(`${T('Recorde', 'Record')} ${Math.max(this.save.best, s.snakes[0].eaten)}`);
      return;
    }
    this.shell.setScore(Shell.pill(0, n[0], this.match.rounds[0], true) + Shell.pill(1, n[1], this.match.rounds[1], true));
    this.shell.setSubtitle(`${T('Tamanho', 'Length')} ${s.snakes[0].body.length} × ${s.snakes[1].body.length} · ${T('meta', 'goal')} ${WIN_LEN}`);
  }

  private endRound() {
    const s = this.s!;
    const u = this.cell;
    for (const c of s.crashes) this.fx.burst(c.p === 0 ? 'faiscas-vermelhas' : 'faiscas', (c.x + 0.5) * u, (c.y + 0.5) * u, u * 0.6);
    const cfg = this.cfg!;
    const n = cfg.names;
    if (s.result === 'over') {
      this.shell.sfx.noise(500, 0.3, 0.45, 1);
      const score = s.snakes[0].eaten;
      if (score > this.save.best) {
        this.save.best = score;
        this.newRecord = true;
        store.save(this.save);
      }
      this.shell.report(cfg, null);
      this.paintHud();
      setTimeout(() => {
        if (this.disposed || this.s !== s) return;
        this.shell.showResult(this.newRecord ? T('Novo recorde!', 'New record!') : T('Fim de jogo', 'Game over'), `${score} ${T('frutas', 'fruits')} · ${T('recorde', 'record')} ${this.save.best}`, () => this.start(cfg));
      }, 1100);
      return;
    }
    const r = s.result as 0 | 1 | 'draw';
    if (s.crashes.length) this.shell.sfx.noise(500, 0.3, 0.45, 1);
    else this.shell.sfx.tone(880, 0.15, 0.15, 'triangle', 1.3);
    this.match = addRound(this.match, r);
    this.paintHud();
    if (r === 'draw') this.shell.toast(T('Rodada empatada!', 'Round tied!'), 1600);
    else {
      this.shell.setTurn(r);
      const why = s.crashes.length ? '' : T(` (chegou a ${WIN_LEN})`, ` (reached ${WIN_LEN})`);
      if (this.match.winner === null) this.shell.toast(`${T('Rodada de', 'Round to')} ${n[r]}${why}! ${this.match.rounds[0]} × ${this.match.rounds[1]}`, 1700);
    }
    this.after = 1.8;
    if (this.match.winner !== null) {
      const w = this.match.winner;
      const ai = cfg.mode === 'ai';
      this.shell.report(cfg, w);
      if (ai && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
      setTimeout(() => {
        if (this.disposed || !this.s) return;
        this.shell.showResult(ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`, `${n[0]} ${this.match.rounds[0]} × ${this.match.rounds[1]} ${n[1]} (${T('rodadas', 'rounds')})`, () => this.start(cfg));
      }, 1200);
    }
  }

  // ------------------------------------------------------------ entrada
  private owner(clientX: number): 0 | 1 {
    if (this.cfg?.mode !== 'local') return 0;
    const r = this.cv.getBoundingClientRect();
    return clientX > r.left + r.width / 2 ? 1 : 0;
  }

  private request(p: 0 | 1, d: Dir) {
    const s = this.s;
    if (!s || s.result !== null || this.shell.paused) return;
    if (this.cfg?.mode !== 'local' && p === 1) return;
    turn(s, p, d);
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const area = this.shell.stage;
    area.addEventListener('pointerdown', (e) => {
      this.shell.sfx.unlock();
      this.swipe.set(e.pointerId, { x: e.clientX, y: e.clientY, who: this.owner(e.clientX) });
    }, sig);
    area.addEventListener('pointermove', (e) => {
      const sw = this.swipe.get(e.pointerId);
      if (!sw) return;
      const dx = e.clientX - sw.x;
      const dy = e.clientY - sw.y;
      if (Math.hypot(dx, dy) < Math.max(14, this.cell * 0.6)) return;
      const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      this.request(sw.who, d);
      sw.x = e.clientX;
      sw.y = e.clientY;
    }, sig);
    const up = (e: PointerEvent) => this.swipe.delete(e.pointerId);
    area.addEventListener('pointerup', up, sig);
    area.addEventListener('pointercancel', up, sig);
    window.addEventListener('keydown', (e) => {
      const k = KEYS[e.key.toLowerCase()];
      if (!k || !this.s) return;
      e.preventDefault();
      this.request(this.cfg?.mode === 'local' ? k[0] : 0, k[1]);
    }, sig);
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    const s = this.s;
    if (s && !this.shell.paused) {
      this.t += dt;
      this.fx.update(dt);
      if (this.countdown > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        if (Math.ceil(this.countdown) !== before) this.shell.sfx.tone(this.countdown > 0 ? 520 : 880, 0.12, 0.18, 'square');
      } else if (s.result === null) {
        this.roundT += dt;
        this.acc += dt;
        const stepT = 1 / stepsPerSecond(s, this.roundT);
        let n = 0;
        while (this.acc >= stepT && n < 4 && s.result === null) {
          if (this.cfg?.mode === 'ai') thinkSnake(s, 1, this.cfg.difficulty, Math.random);
          step(s);
          for (const a of s.ate) {
            const p = xy(a.cell);
            this.fx.burst('confete', (p.x + 0.5) * this.cell, (p.y + 0.5) * this.cell, this.cell * 0.3);
            this.shell.sfx.tone(a.p === 0 ? 660 : 520, 0.06, 0.14, 'triangle', 1.4);
          }
          if (s.ate.length) this.paintHud();
          this.acc -= stepT;
          n++;
        }
        if (s.result !== null) this.endRound();
      } else if (!this.solo && this.match.winner === null && this.after > 0) {
        this.after -= dt;
        if (this.after <= 0) this.newRound();
      }
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth - 12;
    const H = st.clientHeight - 10;
    const cell = Math.max(6, Math.floor(Math.min(W / GRID.w, H / GRID.h)));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.style.width = `${cell * GRID.w}px`;
    this.cv.style.height = `${cell * GRID.h}px`;
    this.cv.width = Math.floor(cell * GRID.w * this.dpr);
    this.cv.height = Math.floor(cell * GRID.h * this.dpr);
    this.cell = cell;
  }

  private draw() {
    const ctx = this.ctx;
    const u = this.cell;
    const W = GRID.w * u;
    const H = GRID.h * u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // gramado quadriculado
    for (let y = 0; y < GRID.h; y++)
      for (let x = 0; x < GRID.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#1d4d3a' : '#215842';
        ctx.fillRect(x * u, y * u, u, u);
      }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    if (this.cfg?.mode === 'local') {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.setLineDash([u * 0.4, u * 0.4]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const s = this.s;
    if (!s) {
      this.drawDemo(ctx, u);
      return;
    }
    for (const f of s.fruits) drawFruit(ctx, f, u, this.t);
    s.snakes.forEach((sn, p) => drawSnake(ctx, sn.body, sn.dir, u, PLAYER_COLORS[p], sn.alive));
    this.fx.draw(ctx);
    if (this.countdown > 0) {
      s.snakes.forEach((sn, p) => {
        const h = xy(sn.body[0]);
        ctx.fillStyle = PLAYER_COLORS[p];
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 8);
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc((h.x + 0.5 + DX[sn.dir] * k) * u, (h.y + 0.5 + DY[sn.dir] * k) * u, u * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `800 ${Math.round(u * 4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.max(1, Math.ceil(this.countdown))), W / 2, H / 2);
    }
  }

  private drawDemo(ctx: CanvasRenderingContext2D, u: number) {
    drawSnake(ctx, [8 * GRID.w + 12, 8 * GRID.w + 11, 8 * GRID.w + 10, 8 * GRID.w + 9, 9 * GRID.w + 9, 10 * GRID.w + 9], 1, u, PLAYER_COLORS[0], true);
    drawFruit(ctx, 8 * GRID.w + 15, u, this.t);
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return { mode: this.cfg?.mode, result: s?.result ?? null, steps: s?.steps ?? 0, rounds: this.match.rounds, countdown: this.countdown, snakes: s?.snakes.map((sn) => ({ len: sn.body.length, alive: sn.alive, eaten: sn.eaten, head: xy(sn.body[0]), dir: sn.dir })), fruits: s?.fruits.map(xy), cell: this.cell, best: this.save.best };
  }
}

function drawFruit(ctx: CanvasRenderingContext2D, cell: number, u: number, t: number) {
  const { x, y } = xy(cell);
  const cx = (x + 0.5) * u;
  const cy = (y + 0.5) * u;
  const r = u * (0.34 + 0.03 * Math.sin(t * 5 + cell));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.9, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffb3a1');
  g.addColorStop(1, '#e02f3f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b3a1a';
  ctx.lineWidth = Math.max(1.5, u * 0.07);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.15, cy - r * 1.3);
  ctx.stroke();
  ctx.fillStyle = '#4fe08a';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.45, cy - r * 1.1, r * 0.4, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(ctx: CanvasRenderingContext2D, body: number[], dir: Dir, u: number, col: string, alive: boolean) {
  if (!body.length) return;
  ctx.globalAlpha = alive ? 1 : 0.45;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const pts = body.map((c) => {
    const p = xy(c);
    return [(p.x + 0.5) * u, (p.y + 0.5) * u] as const;
  });
  const path = (w: number, style: string) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
    ctx.stroke();
  };
  path(u * 0.86, 'rgba(0,0,0,0.3)');
  path(u * 0.78, col);
  path(u * 0.32, 'rgba(255,255,255,0.28)');
  // cabeça com olhos voltados para a direção
  const [hx, hy] = pts[0];
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(hx, hy, u * 0.46, 0, Math.PI * 2);
  ctx.fill();
  const fx = DX[dir];
  const fy = DY[dir];
  for (const side of [-1, 1]) {
    const ex = hx + fx * u * 0.15 + -fy * side * u * 0.2;
    const ey = hy + fy * u * 0.15 + fx * side * u * 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, u * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alive ? '#111' : '#666';
    ctx.beginPath();
    ctx.arc(ex + fx * u * 0.05, ey + fy * u * 0.05, u * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const snake: GameModule = {
  mount(container, { onExit }) {
    const g = new SnakeGame(container, onExit);
    (window as unknown as { __snake?: SnakeGame }).__snake = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __snake?: SnakeGame }).__snake;
      },
    };
  },
};
export default snake;
