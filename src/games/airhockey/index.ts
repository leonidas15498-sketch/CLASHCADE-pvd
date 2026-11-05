import { onMountRollback } from '../shared/lifecycle';
import { coinFlip } from '../shared/coin';
import { T } from '../../i18n/lang';
import { PLAYER_COLORS } from '../shared/players';
import { equipped, HOCKEY_PUCKS, HOCKEY_TABLES, type HockeyPuckPal, type HockeyTablePal } from '../shared/arenaThemes';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { HockeyAI } from './ai';
import { AH, createState, HockeyState, MALLET_R, PUCK_R, setTarget, step, TABLE } from './physics';

const RAIL = 0.09;
const HELP_PT = `<ul>
<li><b>Objetivo:</b> fazer o disco entrar no gol do adversário. Quem fizer <b>7 gols</b> primeiro vence.</li>
<li><b>Controle:</b> arraste o seu rebatedor com o dedo (ou o mouse). Cada um só pode andar no próprio lado da mesa.</li>
<li><b>2 jogadores:</b> o Jogador 1 (coral) fica à esquerda e o Jogador 2 (azul) à direita. A tela aceita os dois dedos ao mesmo tempo.</li>
<li><b>Teclado:</b> Jogador 1 com W A S D; Jogador 2 com as setas.</li>
<li>Depois de cada gol, o disco volta parado no campo de quem sofreu o gol.</li>
<li>Bater com o rebatedor em movimento dá mais velocidade ao disco.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> get the puck into your opponent's goal. First to <b>7 goals</b> wins.</li>
<li><b>Control:</b> drag your mallet with your finger (or the mouse). Each player stays on their own half.</li>
<li><b>2 players:</b> Player 1 (coral) on the left, Player 2 (blue) on the right. The screen takes both fingers at once.</li>
<li><b>Keyboard:</b> Player 1 with W A S D; Player 2 with the arrow keys.</li>
<li>After each goal, the puck restarts still on the side that conceded.</li>
<li>Hitting with a moving mallet gives the puck more speed.</li>
</ul>`;

class AirHockeyGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: HockeyState | null = null;
  private cfg: StartConfig | null = null;
  private ai: HockeyAI | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private scale = 100;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private disposed = false;
  private pointers = new Map<number, 0 | 1>();
  private keys = new Set<string>();
  private flash: { player: 0 | 1; t: number } | null = null;
  private trail: { x: number; y: number }[] = [];
  private evIdx = 0;
  private ac = new AbortController();
  private nextServe: 0 | 1 = 0;
  private table = equipped('hockey.table', HOCKEY_TABLES);
  private puck = equipped('hockey.puck', HOCKEY_PUCKS);

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'airhockey',
      title: 'Air Hockey',
      subtitle: T('Disco no ar, 7 gols', 'Floating puck, first to 7'),
      modes: { ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo: cada um no seu lado da tela.', 'Both play at once: each on their own side of the screen.'),
      // "Ricochet Velocity" (Leon, Gemini). Volume ~2 dB abaixo das outras faixas para as batidas aparecerem.
      musicUrl: './music/ricochet-velocity.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      shop: [
        { slot: 'hockey.table', tabPt: 'Mesa', tabEn: 'Table', items: HOCKEY_TABLES as never, preview: (c, w, h, it) => previewHockey(c, w, h, (it.pal as HockeyTablePal), this.puck.pal, false), onChange: () => { this.table = equipped('hockey.table', HOCKEY_TABLES); this.draw(); } },
        { slot: 'hockey.puck', tabPt: 'Disco', tabEn: 'Puck', items: HOCKEY_PUCKS as never, preview: (c, w, h, it) => previewHockey(c, w, h, this.table.pal, (it.pal as HockeyPuckPal), true), onChange: () => { this.puck = equipped('hockey.puck', HOCKEY_PUCKS); this.draw(); } },
      ],
      onExit,
      onStart: (cfg) => {
        this.nextServe = coinFlip(); // 05/11: 1º saque sorteado (start() troca; continua 50/50), depois alterna
        this.start(cfg);
      },
      onPause: (p) => {
        this.keys.clear(); this.pointers.clear();
        if (!p) this.last = performance.now();
      },
      onRestart: () => this.cfg && this.start(this.cfg),
      onMenu: () => {
        this.s = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Mesa de air hockey', 'Air hockey table'));
    this.cv.style.touchAction = 'none';
    this.cv.style.borderRadius = '18px';
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

  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.nextServe = this.nextServe === 0 ? 1 : 0;
    this.s = createState(this.nextServe);
    this.s.freeze = 1;
    this.ai = cfg.mode === 'ai' ? new HockeyAI(cfg.difficulty) : null;
    this.evIdx = 0;
    this.flash = null;
    this.trail = [];
    this.pointers.clear();
    this.shell.setTurn(null);
    this.shell.toast(T('Valendo! Primeiro a fazer 7 gols vence.', 'Go! First to 7 goals wins.'));
    this.paintHud();
  }

  private paintHud() {
    const s = this.s;
    const n = this.cfg?.names ?? ['Jogador 1', 'Jogador 2'];
    this.shell.setScore(s ? Shell.pill(0, n[0], s.score[0], true) + Shell.pill(1, n[1], s.score[1], true) : '');
  }

  // ------------------------------------------------------------ entrada
  private toWorld(e: PointerEvent) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale };
  }

  private bindInput() {
    const cv = this.cv;
    const sig = { signal: this.ac.signal };
    const owner = (x: number): 0 | 1 => (this.cfg?.mode === 'local' && x > TABLE.w / 2 ? 1 : 0);
    cv.addEventListener('pointerdown', (e) => {
      this.shell.sfx.unlock();
      if (!this.s || this.shell.paused || this.shell.overlayOpen()) return;
      const p = this.toWorld(e);
      const who = owner(p.x);
      this.pointers.set(e.pointerId, who);
      cv.setPointerCapture(e.pointerId);
      setTarget(this.s, who, p.x, p.y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.s || this.shell.paused || this.shell.overlayOpen()) return;
      const p = this.toWorld(e);
      const who = this.pointers.get(e.pointerId);
      if (who !== undefined) setTarget(this.s, who, p.x, p.y);
      else if (e.pointerType === 'mouse' && this.cfg?.mode === 'ai') setTarget(this.s, 0, p.x, p.y);
    });
    const up = (e: PointerEvent) => this.pointers.delete(e.pointerId);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => { if (!this.shell.paused && !this.shell.overlayOpen()) this.keys.add(e.key.toLowerCase()); }, sig);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), sig);
  }

  private keyMove(dt: number) {
    const s = this.s!;
    const v = 2.2 * dt;
    const k = this.keys;
    const mv = (p: 0 | 1, l: string, r: string, u: string, d: string) => {
      const dx = (k.has(r) ? 1 : 0) - (k.has(l) ? 1 : 0);
      const dy = (k.has(d) ? 1 : 0) - (k.has(u) ? 1 : 0);
      if (dx || dy) setTarget(s, p, s.mallets[p].tx + dx * v, s.mallets[p].ty + dy * v);
    };
    mv(0, 'a', 'd', 'w', 's');
    if (this.cfg?.mode === 'local') mv(1, 'arrowleft', 'arrowright', 'arrowup', 'arrowdown');
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    const s = this.s;
    if (s && !this.shell.paused && s.winner === null) {
      this.keyMove(dt);
      this.acc += dt;
      let n = 0;
      while (this.acc >= AH.dt && n < 40) {
        if (this.ai) this.ai.update(s, AH.dt);
        step(s);
        this.acc -= AH.dt;
        n++;
      }
      this.handleEvents();
      if (this.flash) {
        this.flash.t -= dt;
        if (this.flash.t <= 0) {
          this.flash = null;
          this.shell.setTurn(null);
        }
      }
      const sp = Math.hypot(s.puck.vx, s.puck.vy);
      if (sp > 0.5) {
        this.trail.push({ x: s.puck.x, y: s.puck.y });
        if (this.trail.length > 14) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private handleEvents() {
    const s = this.s!;
    for (; this.evIdx < s.events.length; this.evIdx++) {
      const e = s.events[this.evIdx];
      if (e.type === 'wall') this.shell.sfx.tone(320, 0.05, Math.min(0.3, 0.05 + e.speed / 25), 'square', 0.7);
      else if (e.type === 'hit') this.shell.sfx.noise(1800, 0.06, Math.min(0.6, 0.15 + e.speed / 12), 3);
      else if (e.type === 'goal') {
        const n = this.cfg!.names;
        this.flash = { player: e.scorer, t: 1.2 };
        this.trail = [];
        this.shell.setTurn(e.scorer);
        this.shell.sfx.win();
        this.paintHud();
        if (s.winner !== null) {
          const w = s.winner;
          const ai = this.cfg!.mode === 'ai';
          this.shell.report(this.cfg!, w);
          if (ai && w === 1) this.shell.sfx.lose();
          setTimeout(() => {
            if (this.disposed || !this.s) return;
            this.shell.showResult(
              ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`,
              `${n[0]} ${s.score[0]} × ${s.score[1]} ${n[1]}`,
              () => this.start(this.cfg!),
            );
          }, 900);
        } else this.shell.toast(`${T('Gol de', 'Goal for')} ${n[e.scorer]}! ${s.score[0]} × ${s.score[1]}`);
      }
    }
    if (s.events.length > 200) {
      s.events = [];
      this.evIdx = 0;
    }
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth - 16;
    const H = st.clientHeight - 12;
    const fw = TABLE.w + 2 * RAIL;
    const fh = TABLE.h + 2 * RAIL;
    const sc = Math.max(10, Math.min(W / fw, H / fh));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // otimização 01/11: 2,5 → 2 (56% menos pixels, nitidez igual a olho nu)
    const cw = Math.floor(fw * sc);
    const ch = Math.floor(fh * sc);
    this.cv.style.width = `${cw}px`;
    this.cv.style.height = `${ch}px`;
    this.cv.width = Math.floor(cw * this.dpr);
    this.cv.height = Math.floor(ch * this.dpr);
    this.scale = sc;
    this.ox = RAIL * sc;
    this.oy = RAIL * sc;
  }

  private draw() {
    const ctx = this.ctx;
    const sc = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.dpr * sc, 0, 0, this.dpr * sc, this.dpr * this.ox, this.dpr * this.oy);
    const px = 1 / sc;
    const W = TABLE.w;
    const H = TABLE.h;
    drawTable(ctx, this.table.pal, px);
    // flash de gol
    if (this.flash) {
      ctx.fillStyle = hexA(PLAYER_COLORS[this.flash.player], 0.35 * (this.flash.t / 1.2));
      ctx.fillRect(0, 0, W, H);
    }
    const s = this.s;
    if (s) {
      // rastro do disco
      for (let i = 1; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        ctx.strokeStyle = hexA(this.table.pal.dark ? this.puck.pal.ring : '#283c5a', 0.25 * k);
        ctx.lineWidth = PUCK_R * 1.6 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      // disco
      const a = Math.min(1, this.acc / AH.dt);
      const pxk = s.puck.px + (s.puck.x - s.puck.px) * a;
      const pyk = s.puck.py + (s.puck.y - s.puck.py) * a;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      disc(ctx, pxk + 0.008, pyk + 0.012, PUCK_R);
      drawPuck(ctx, pxk, pyk, this.puck.pal);
      // rebatedores
      s.mallets.forEach((m, i) => {
        const c = PLAYER_COLORS[i];
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        disc(ctx, m.x + 0.01, m.y + 0.016, MALLET_R);
        const gr = ctx.createRadialGradient(m.x - MALLET_R * 0.3, m.y - MALLET_R * 0.35, MALLET_R * 0.1, m.x, m.y, MALLET_R);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.3, c);
        gr.addColorStop(1, shadeHex(c, -0.35));
        ctx.fillStyle = gr;
        disc(ctx, m.x, m.y, MALLET_R);
        ctx.fillStyle = shadeHex(c, -0.2);
        disc(ctx, m.x, m.y, MALLET_R * 0.45);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        disc(ctx, m.x - MALLET_R * 0.12, m.y - MALLET_R * 0.14, MALLET_R * 0.18);
      });
    }
  }
}

/** Mesa (trilho, superfície, marcações e gols) com a paleta do tema da loja. Usada no jogo e na amostra da loja. */
function drawTable(ctx: CanvasRenderingContext2D, pal: HockeyTablePal, px: number) {
  const W = TABLE.w;
  const H = TABLE.h;
  const g0 = (H - TABLE.goal) / 2;
  // trilho
  rr(ctx, -RAIL, -RAIL, W + 2 * RAIL, H + 2 * RAIL, 0.1);
  ctx.fillStyle = pal.rail;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = px * 2;
  ctx.stroke();
  // superfície
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.top);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  rr(ctx, 0, 0, W, H, 0.06);
  ctx.fill();
  // metades na cor de cada jogador (bem suave)
  if (pal.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 70; i++) ctx.fillRect(((i * 0.6180339) % 1) * W, ((i * 0.7548776) % 1) * H, 0.006 + (i % 3) * 0.003, 0.006 + (i % 3) * 0.003);
  }
  ctx.fillStyle = hexA(PLAYER_COLORS[0], pal.dark ? 0.12 : 0.07);
  ctx.fillRect(0, 0, W / 2, H);
  ctx.fillStyle = hexA(PLAYER_COLORS[1], pal.dark ? 0.12 : 0.07);
  ctx.fillRect(W / 2, 0, W / 2, H);
  // furinhos do colchão de ar
  ctx.fillStyle = pal.holes;
  for (let x = 0.05; x < W; x += 0.1) for (let y = 0.05; y < H; y += 0.1) ctx.fillRect(x - 0.003, y - 0.003, 0.006, 0.006);
  // marcações
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 0.16, 0, Math.PI * 2);
  ctx.stroke();
  for (const side of [0, 1] as const) {
    const x = side === 0 ? 0 : W;
    ctx.strokeStyle = hexA(PLAYER_COLORS[side], 0.75);
    ctx.lineWidth = 0.01;
    ctx.beginPath();
    ctx.arc(x, H / 2, 0.24, side === 0 ? -Math.PI / 2 : Math.PI / 2, side === 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
    ctx.stroke();
    // boca do gol
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(side === 0 ? -RAIL : W, g0, RAIL, TABLE.goal);
    ctx.fillStyle = PLAYER_COLORS[side];
    ctx.fillRect(side === 0 ? -0.012 : W, g0, 0.012, TABLE.goal);
  }
}

function drawPuck(ctx: CanvasRenderingContext2D, x: number, y: number, pal: HockeyPuckPal) {
  ctx.fillStyle = pal.body;
  disc(ctx, x, y, PUCK_R);
  if (pal.glow) {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = pal.ring;
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.arc(x, y, PUCK_R * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Amostra da loja: a mesa inteira (e o disco no centro) desenhada pelo mesmo código do jogo. */
function previewHockey(ctx: CanvasRenderingContext2D, w: number, h: number, table: HockeyTablePal, puck: HockeyPuckPal, zoomPuck: boolean) {
  ctx.fillStyle = '#0a1433';
  ctx.fillRect(0, 0, w, h);
  const fw = TABLE.w + 2 * RAIL;
  const fh = TABLE.h + 2 * RAIL;
  const sc = zoomPuck ? Math.min(w / 0.5, h / 0.28) : Math.min(w / fw, h / fh);
  const cx = TABLE.w / 2;
  ctx.save();
  ctx.setTransform(sc, 0, 0, sc, w / 2 - cx * sc, h / 2 - (TABLE.h / 2) * sc);
  drawTable(ctx, table, 1 / sc);
  drawPuck(ctx, TABLE.w / 2, TABLE.h / 2, puck);
  ctx.restore();
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shadeHex(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const airhockey: GameModule = {
  mount(container, { onExit }) {
    const g = new AirHockeyGame(container, onExit);
    (window as unknown as { __airhockey?: AirHockeyGame }).__airhockey = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __airhockey?: AirHockeyGame }).__airhockey;
      },
    };
  },
};
export default airhockey;
