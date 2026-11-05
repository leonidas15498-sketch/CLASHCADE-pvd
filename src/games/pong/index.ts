import { onMountRollback } from '../shared/lifecycle';
import { coinFlip } from '../shared/coin';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { equipped, PONG_BALLS, PONG_COURTS, type PongBallPal, type PongCourtPal } from '../shared/arenaThemes';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { PongAI } from './ai';
import { createPong, paddleX, PONG, PongState, setPaddle, stepPong, TABLE } from './physics';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> rebater a bola com a sua raquete e fazê-la passar pela raquete do adversário. Quem fizer <b>${PONG.pointsToWin} pontos</b> primeiro vence.</li>
<li><b>Controle:</b> arraste o dedo para cima e para baixo; a raquete segue o dedo.</li>
<li><b>2 jogadores:</b> ao mesmo tempo, cada um na sua metade da tela (Jogador 1 coral à esquerda, Jogador 2 azul à direita).</li>
<li><b>Efeito:</b> bater com a ponta da raquete manda a bola mais inclinada; no centro ela volta reta.</li>
<li>A bola acelera a cada rebatida. Depois de cada ponto, ela sai do meio na direção de quem perdeu o ponto.</li>
<li><b>Teclado:</b> Jogador 1 com W e S; Jogador 2 com ↑ e ↓ (contra a IA, as setas também movem você).</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> return the ball with your paddle and get it past your opponent's. First to <b>${PONG.pointsToWin} points</b> wins.</li>
<li><b>Control:</b> drag your finger up and down; the paddle follows it.</li>
<li><b>2 players:</b> at the same time, each on their own half of the screen (Player 1 coral on the left, Player 2 blue on the right).</li>
<li><b>Spin:</b> hitting with the paddle edge sends the ball at a steeper angle; the center sends it straight.</li>
<li>The ball speeds up with each hit. After each point it serves from the middle toward whoever lost the point.</li>
<li><b>Keyboard:</b> Player 1 with W and S; Player 2 with ↑ and ↓ (vs the AI, the arrows also move you).</li>
</ul>`;

const RAIL = 0.05;

export class PongGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: PongState | null = null;
  private cfg: StartConfig | null = null;
  private ai: PongAI | null = null;
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
  /** Rastro por tempo (0,12 s) e distância (≥ 1 cm): mesmo comprimento em 30, 60 ou 120 FPS. */
  private trail: Array<{ x: number; y: number; t: number }> = [];
  private court = equipped('pong.court', PONG_COURTS);
  private ball = equipped('pong.ball', PONG_BALLS);
  private fx = new ParticleSystem();
  private evIdx = 0;
  private ac = new AbortController();
  private nextServe: 0 | 1 = 1;
  private flash = 0;

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'pong',
      title: 'Pong',
      subtitle: T(`Raquetes e bola, ${PONG.pointsToWin} pontos`, `Paddles and ball, first to ${PONG.pointsToWin}`),
      modes: { ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo: cada um na sua metade da tela.', 'Both play at once: each on their own half of the screen.'),
      // "Center Court Rally" (Leon, Gemini): 120 BPM, 80 compassos (160 s), -15 LUFS como hockey e Duelo.
      musicUrl: './music/center-court-rally.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      shop: [
        { slot: 'pong.court', tabPt: 'Quadra', tabEn: 'Court', items: PONG_COURTS as never, preview: (c, w, h, it) => previewPong(c, w, h, it.pal as PongCourtPal, this.ball.pal), onChange: () => { this.court = equipped('pong.court', PONG_COURTS); this.draw(); } },
        { slot: 'pong.ball', tabPt: 'Bola', tabEn: 'Ball', items: PONG_BALLS as never, preview: (c, w, h, it) => previewPong(c, w, h, this.court.pal, it.pal as PongBallPal), onChange: () => { this.ball = equipped('pong.ball', PONG_BALLS); this.draw(); } },
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
    this.cv.setAttribute('aria-label', T('Mesa de Pong', 'Pong table'));
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

  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.nextServe = (1 - this.nextServe) as 0 | 1;
    this.s = createPong(this.nextServe);
    this.s.freeze = 1.2;
    this.ai = cfg.mode === 'ai' ? new PongAI(cfg.difficulty) : null;
    this.evIdx = 0;
    this.trail = [];
    this.fx.clear();
    this.pointers.clear();
    this.shell.setTurn(null);
    this.shell.toast(T(`Valendo! Primeiro a fazer ${PONG.pointsToWin} pontos vence.`, `Go! First to ${PONG.pointsToWin} points wins.`));
    this.paintHud();
  }

  private paintHud() {
    const s = this.s;
    const n = this.cfg?.names ?? ['Jogador 1', 'Jogador 2'];
    this.shell.setScore(s ? Shell.pill(0, n[0], s.score[0], true) + Shell.pill(1, n[1], s.score[1], true) : '');
  }

  // ------------------------------------------------------------ entrada (mesmo esquema do Air Hockey)
  private toWorldY(e: PointerEvent) {
    const r = this.cv.getBoundingClientRect();
    return (e.clientY - r.top - this.oy) / this.scale;
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const area = this.shell.stage;
    const owner = (clientX: number): 0 | 1 => {
      if (this.cfg?.mode !== 'local') return 0;
      const r = this.cv.getBoundingClientRect();
      return clientX > r.left + r.width / 2 ? 1 : 0;
    };
    area.addEventListener(
      'pointerdown',
      (e) => {
        this.shell.sfx.unlock();
        if (!this.s || this.shell.paused || this.shell.overlayOpen()) return;
        const who = owner(e.clientX);
        if (this.ai && who === 1) return;
        this.pointers.set(e.pointerId, who);
        area.setPointerCapture(e.pointerId);
        setPaddle(this.s, who, this.toWorldY(e));
      },
      sig,
    );
    area.addEventListener(
      'pointermove',
      (e) => {
        if (!this.s || this.shell.paused || this.shell.overlayOpen()) return;
        const who = this.pointers.get(e.pointerId);
        if (who !== undefined) setPaddle(this.s, who, this.toWorldY(e));
        else if (e.pointerType === 'mouse' && this.cfg?.mode === 'ai') setPaddle(this.s, 0, this.toWorldY(e));
      },
      sig,
    );
    const up = (e: PointerEvent) => this.pointers.delete(e.pointerId);
    area.addEventListener('pointerup', up, sig);
    area.addEventListener('pointercancel', up, sig);
    window.addEventListener('keydown', (e) => { if (!this.shell.paused && !this.shell.overlayOpen()) this.keys.add(e.key.toLowerCase()); }, sig);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), sig);
  }

  private keyMove(dt: number) {
    const s = this.s!;
    const v = PONG.maxPaddle * dt;
    const k = this.keys;
    const mv = (p: 0 | 1, u: string, d: string) => {
      const dy = (k.has(d) ? 1 : 0) - (k.has(u) ? 1 : 0);
      if (dy) setPaddle(s, p, s.paddles[p].ty + dy * v);
    };
    mv(0, 'w', 's');
    if (this.cfg?.mode === 'local') mv(1, 'arrowup', 'arrowdown');
    else mv(0, 'arrowup', 'arrowdown');
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    const s = this.s;
    if (s && !this.shell.paused && s.winner === null) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= PONG.dt && n < 40) {
        // Human input and AI advance on the same clock at every display FPS.
        this.keyMove(PONG.dt);
        this.ai?.update(s, PONG.dt);
        stepPong(s);
        this.acc -= PONG.dt;
        n++;
      }
      this.handleEvents();
      if (s.freeze <= 0) {
        const lt = this.trail[this.trail.length - 1];
        if (!lt || Math.hypot(s.ball.x - lt.x, s.ball.y - lt.y) >= 0.01) this.trail.push({ x: s.ball.x, y: s.ball.y, t: s.t });
        while (this.trail.length && s.t - this.trail[0].t > 0.12) this.trail.shift();
      } else this.trail = [];
    }
    if (!this.shell.paused) {
      this.fx.update(dt);
      if (this.flash > 0) {
        this.flash -= dt;
        if (this.flash <= 0) this.shell.setTurn(null);
      }
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private handleEvents() {
    const s = this.s!;
    for (; this.evIdx < s.events.length; this.evIdx++) {
      const e = s.events[this.evIdx];
      if (e.type === 'wall') this.shell.sfx.tone(300, 0.05, 0.18, 'square', 0.8);
      else if (e.type === 'hit') {
        this.shell.sfx.tone(520 + e.speed * 60, 0.06, 0.25, 'square', 0.9);
        this.fx.burst('simples', s.ball.x, s.ball.y, PONG.ballR);
      } else if (e.type === 'point') {
        const n = this.cfg!.names;
        this.flash = 1;
        this.shell.setTurn(e.scorer);
        this.paintHud();
        this.trail = [];
        if (s.winner !== null) {
          const w = s.winner;
          const ai = this.cfg!.mode === 'ai';
          this.shell.report(this.cfg!, w);
          if (ai && w === 1) this.shell.sfx.lose();
          else this.shell.sfx.win();
          setTimeout(() => {
            if (this.disposed || this.s !== s) return;
            this.shell.showResult(ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`, `${n[0]} ${s.score[0]} × ${s.score[1]} ${n[1]}`, () => this.start(this.cfg!));
          }, 900);
        } else {
          this.shell.sfx.tone(260, 0.25, 0.2, 'triangle', 0.6);
          this.shell.toast(`${T('Ponto de', 'Point for')} ${n[e.scorer]}! ${s.score[0]} × ${s.score[1]}`, 1100);
        }
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
    drawCourt(ctx, this.court.pal, px);
    const s = this.s;
    if (!s) return;
    // placar grande no fundo
    // (texto em pixels de tela: fonte em fração de pixel não é confiável em todos os navegadores)
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.court.pal.score;
    ctx.font = `800 ${Math.round(0.32 * sc)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s.score[0]), this.ox + W * 0.25 * sc, this.oy + (H / 2) * sc);
    ctx.fillText(String(s.score[1]), this.ox + W * 0.75 * sc, this.oy + (H / 2) * sc);
    ctx.restore();
    // raquetes
    for (const p of [0, 1] as const) {
      const x = paddleX(p);
      const pad = s.paddles[p];
      ctx.shadowColor = PLAYER_COLORS[p];
      ctx.shadowBlur = 16;
      ctx.fillStyle = PLAYER_COLORS[p];
      ctx.beginPath();
      ctx.roundRect(x - PONG.paddleW / 2, pad.y - PONG.paddleH / 2, PONG.paddleW, PONG.paddleH, PONG.paddleW / 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // rastro e bola
    const b = s.ball;
    for (const t of this.trail) {
      const k = 1 - Math.min(1, (s.t - t.t) / 0.12); // 1 = novo, 0 = some
      ctx.globalAlpha = k * 0.25;
      ctx.fillStyle = this.ball.pal.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PONG.ballR * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (s.freeze <= 0 || Math.floor(s.freeze * 6) % 2 === 0) {
      ctx.shadowColor = this.ball.pal.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = this.ball.pal.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, PONG.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    this.fx.draw(ctx);
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s ? { score: [...s.score], winner: s.winner, ball: { ...s.ball }, paddles: s.paddles.map((p) => p.y), freeze: s.freeze, mode: this.cfg?.mode } : null;
  }
}

const pong: GameModule = {
  mount(container, { onExit }) {
    const g = new PongGame(container, onExit);
    (window as unknown as { __pong?: PongGame }).__pong = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __pong?: PongGame }).__pong;
      },
    };
  },
};
export default pong;

/** Quadra com a paleta do tema da loja (jogo e amostra da loja usam o mesmo código). */
function drawCourt(ctx: CanvasRenderingContext2D, pal: PongCourtPal, px: number) {
  const W = TABLE.w;
  const H = TABLE.h;
  // quadra
  ctx.fillStyle = pal.rail;
  ctx.beginPath();
  ctx.roundRect(-RAIL, -RAIL, W + 2 * RAIL, H + 2 * RAIL, 0.06);
  ctx.fill();
  ctx.fillStyle = pal.floor;
  ctx.fillRect(0, 0, W, H);
  if (pal.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 60; i++) ctx.fillRect(((i * 0.6180339) % 1) * W, ((i * 0.7548776) % 1) * H, 0.006 + (i % 3) * 0.003, 0.006 + (i % 3) * 0.003);
  }
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,107,74,0.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(61,139,255,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 3 * px;
  ctx.strokeRect(0, 0, W, H);
  // rede tracejada
  ctx.setLineDash([0.04, 0.035]);
  ctx.lineWidth = 4 * px;
  ctx.strokeStyle = pal.net;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Amostra da loja: quadra inteira, raquetes nas cores dos jogadores e a bola no centro. */
function previewPong(ctx: CanvasRenderingContext2D, w: number, h: number, court: PongCourtPal, ball: PongBallPal) {
  ctx.fillStyle = '#0a1433';
  ctx.fillRect(0, 0, w, h);
  const sc = Math.min(w / (TABLE.w + 2 * RAIL), h / (TABLE.h + 2 * RAIL));
  ctx.save();
  ctx.setTransform(sc, 0, 0, sc, w / 2 - (TABLE.w / 2) * sc, h / 2 - (TABLE.h / 2) * sc);
  drawCourt(ctx, court, 1 / sc);
  for (const p of [0, 1] as const) {
    ctx.fillStyle = PLAYER_COLORS[p];
    ctx.beginPath();
    ctx.roundRect(paddleX(p) - PONG.paddleW / 2, TABLE.h / 2 - PONG.paddleH / 2, PONG.paddleW, PONG.paddleH, PONG.paddleW / 2);
    ctx.fill();
  }
  ctx.shadowColor = ball.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(TABLE.w / 2, TABLE.h / 2, PONG.ballR * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
