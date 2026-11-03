import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { TrailsAI } from './ai';
import { addRound, createRound, Dir, DX, DY, GRID, MatchScore, ROUNDS_TO_WIN, RoundState, stepRound, stepsPerSecond, turn } from './logic';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> cada moto deixa um rastro de luz. Quem bater em uma parede ou em qualquer rastro perde a rodada.
Quem vencer <b>${ROUNDS_TO_WIN} rodadas</b> primeiro vence a partida.</li>
<li><b>Controle:</b> deslize o dedo para a direção em que quer virar (cima, baixo, esquerda, direita). Dá para encadear curvas sem tirar o dedo.</li>
<li><b>2 jogadores:</b> os dois jogam ao mesmo tempo. O Jogador 1 (coral) usa a metade esquerda da tela; o Jogador 2 (azul), a direita.</li>
<li><b>Teclado:</b> Jogador 1 com W A S D; Jogador 2 com as setas (contra a IA, as setas também movem você).</li>
<li>Não dá para voltar pelo próprio caminho (meia-volta). As motos aceleram aos poucos durante a rodada.</li>
<li>Bateram ao mesmo tempo ou de frente: a rodada empata e é jogada de novo.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> each bike leaves a light trail. Hit a wall or any trail and you lose the round.
First to win <b>${ROUNDS_TO_WIN} rounds</b> wins the match.</li>
<li><b>Control:</b> swipe toward the direction you want to turn (up, down, left, right). You can chain turns without lifting your finger.</li>
<li><b>2 players:</b> both play at once. Player 1 (coral) uses the left half of the screen; Player 2 (blue), the right half.</li>
<li><b>Keyboard:</b> Player 1 with W A S D; Player 2 with the arrow keys (vs the AI, the arrows also move you).</li>
<li>You can't turn back on your own path (U-turn). Bikes speed up gradually during the round.</li>
<li>Crash at the same time or head-on: the round is a tie and is replayed.</li>
</ul>`;

const KEYS: Record<string, [0 | 1, Dir]> = {
  w: [0, 0],
  d: [0, 1],
  s: [0, 2],
  a: [0, 3],
  arrowup: [1, 0],
  arrowright: [1, 1],
  arrowdown: [1, 2],
  arrowleft: [1, 3],
};

class TrailsGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: StartConfig | null = null;
  private s: RoundState | null = null;
  private match: MatchScore = { rounds: [0, 0], winner: null };
  private ai: TrailsAI | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private roundT = 0;
  /** Contagem antes da rodada (s). */
  private countdown = 0;
  /** Pausa depois da batida antes da próxima rodada (s). */
  private after = 0;
  private cell = 10;
  private dpr = 1;
  private bgLayer: HTMLCanvasElement | null = null;
  private bgKey = '';
  private disposed = false;
  private fx = new ParticleSystem();
  private swipe = new Map<number, { x: number; y: number; who: 0 | 1 }>();
  private ac = new AbortController();
  private t = 0;
  private roundNo = 0;

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'trails',
      title: T('Duelo de Rastros', 'Light Trail Duel'),
      subtitle: T(`Não bata! Melhor de ${ROUNDS_TO_WIN * 2 - 1} rodadas`, `Don't crash! Best of ${ROUNDS_TO_WIN * 2 - 1} rounds`),
      modes: { ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo: cada um desliza na sua metade da tela.', 'Both play at once: each swipes on their own half of the screen.'),
      // "Apex Cornering" (Leon, Gemini): cortada em 86 compassos (166,45 s, 124 BPM), normalizada a -15 LUFS como a do hockey.
      musicUrl: './music/apex-cornering.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
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
    this.cv.setAttribute('aria-label', T('Arena do Duelo de Rastros', 'Light Trail Duel arena'));
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

  // ----------------------------------------------------------- partida
  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.match = { rounds: [0, 0], winner: null };
    this.ai = cfg.mode === 'ai' ? new TrailsAI(cfg.difficulty) : null;
    this.roundNo = 0;
    this.newRound();
  }

  private newRound() {
    this.roundNo++;
    this.s = createRound(Math.floor(Math.random() * 9) - 4);
    this.acc = 0;
    this.roundT = 0;
    this.countdown = 2.4;
    this.after = 0;
    this.fx.clear();
    this.swipe.clear();
    this.shell.setTurn(null);
    this.paintHud();
    this.shell.toast(this.roundNo === 1 ? T('Deslize para virar. Não bata!', "Swipe to turn. Don't crash!") : `${T('Rodada', 'Round')} ${this.roundNo}`, 1800);
  }

  private paintHud() {
    const n = this.cfg?.names ?? ['Jogador 1', 'Jogador 2'];
    this.shell.setScore(this.s ? Shell.pill(0, n[0], this.match.rounds[0], true) + Shell.pill(1, n[1], this.match.rounds[1], true) : '');
  }

  private endRound() {
    const s = this.s!;
    const r = s.result!;
    const u = this.cell;
    for (const c of s.crashes) {
      this.fx.burst(c.p === 0 ? 'faiscas-vermelhas' : 'faiscas', (c.x + 0.5) * u, (c.y + 0.5) * u, u * 0.6);
    }
    this.shell.sfx.noise(500, 0.35, 0.5, 1);
    this.shell.sfx.tone(140, 0.4, 0.25, 'sawtooth', 0.4);
    this.match = addRound(this.match, r);
    this.paintHud();
    const n = this.cfg!.names;
    if (r === 'draw') {
      this.shell.toast(T('Batida dupla! Rodada empatada.', 'Double crash! Round tied.'), 1600);
    } else {
      this.shell.setTurn(r);
      if (this.match.winner === null) this.shell.toast(`${T('Rodada de', 'Round to')} ${n[r]}! ${this.match.rounds[0]} × ${this.match.rounds[1]}`, 1600);
    }
    this.after = 1.7;
    if (this.match.winner !== null) {
      const w = this.match.winner;
      const ai = this.cfg!.mode === 'ai';
      this.shell.report(this.cfg!, w);
      if (ai && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
      setTimeout(() => {
        if (this.disposed || !this.s) return;
        this.shell.showResult(
          ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`,
          `${n[0]} ${this.match.rounds[0]} × ${this.match.rounds[1]} ${n[1]} (${T('rodadas', 'rounds')})`,
          () => this.start(this.cfg!),
        );
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
    if (this.ai && p === 1) return; // a IA controla o J2
    turn(s, p, d);
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    // os toques valem na tela toda do jogo (não só no canvas): fica mais fácil no celular
    const area = this.shell.stage;
    area.addEventListener(
      'pointerdown',
      (e) => {
        this.shell.sfx.unlock();
        this.swipe.set(e.pointerId, { x: e.clientX, y: e.clientY, who: this.owner(e.clientX) });
      },
      sig,
    );
    area.addEventListener(
      'pointermove',
      (e) => {
        const sw = this.swipe.get(e.pointerId);
        if (!sw) return;
        const dx = e.clientX - sw.x;
        const dy = e.clientY - sw.y;
        const min = Math.max(14, this.cell * 0.9);
        if (Math.hypot(dx, dy) < min) return;
        const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
        this.request(sw.who, d);
        sw.x = e.clientX;
        sw.y = e.clientY;
      },
      sig,
    );
    const up = (e: PointerEvent) => this.swipe.delete(e.pointerId);
    area.addEventListener('pointerup', up, sig);
    area.addEventListener('pointercancel', up, sig);
    window.addEventListener(
      'keydown',
      (e) => {
        const k = KEYS[e.key.toLowerCase()];
        if (!k || !this.s) return;
        e.preventDefault();
        const p = this.cfg?.mode === 'local' ? k[0] : 0;
        this.request(p, k[1]);
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
        const stepT = 1 / stepsPerSecond(this.roundT);
        let n = 0;
        while (this.acc >= stepT && n < 4 && s.result === null) {
          this.ai?.think(s);
          stepRound(s);
          this.acc -= stepT;
          n++;
        }
        if (s.result !== null) this.endRound();
      } else if (this.match.winner === null && this.after > 0) {
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
    const cell = Math.max(4, Math.min(W / GRID.w, H / GRID.h));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // otimização 01/11: 2,5 → 2 (56% menos pixels, nitidez igual a olho nu)
    const cw = cell * GRID.w;
    const ch = cell * GRID.h;
    this.cv.style.width = `${cw}px`;
    this.cv.style.height = `${ch}px`;
    this.cv.width = Math.floor(cw * this.dpr);
    this.cv.height = Math.floor(ch * this.dpr);
    this.cell = cell;
  }

  private paintStatic(ctx: CanvasRenderingContext2D, W: number, H: number, u: number) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // fundo com grade
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f1230');
    bg.addColorStop(1, '#090a1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,140,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID.w; x += 2) {
      ctx.moveTo(x * u + 0.5, 0);
      ctx.lineTo(x * u + 0.5, H);
    }
    for (let y = 0; y <= GRID.h; y += 2) {
      ctx.moveTo(0, y * u + 0.5);
      ctx.lineTo(W, y * u + 0.5);
    }
    ctx.stroke();
    // divisória das metades no 2P (onde cada um desliza)
    if (this.cfg?.mode === 'local') {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.setLineDash([u * 0.6, u * 0.6]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // moldura da arena (referência 03): metade vermelha / metade azul com brilho e marcas âmbar nos cantos
    const fg = ctx.createLinearGradient(0, 0, W, 0);
    fg.addColorStop(0, PLAYER_COLORS[0]);
    fg.addColorStop(0.5, '#b8c6ff');
    fg.addColorStop(1, PLAYER_COLORS[1]);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0,224,255,0.6)';
    ctx.shadowBlur = 10;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffc24a';
    const cl = Math.min(W, H) * 0.08;
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]] as const) {
      for (let k = 0; k < 3; k++) {
        const o = 4 + k * cl * 0.32;
        ctx.beginPath();
        ctx.moveTo(cx + sx * o, cy + sy * 2);
        ctx.lineTo(cx + sx * (o + cl * 0.16), cy + sy * 2);
        ctx.lineTo(cx + sx * 2, cy + sy * (o + cl * 0.16));
        ctx.lineTo(cx + sx * 2, cy + sy * o);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

  }

  private draw() {
    const ctx = this.ctx;
    const u = this.cell;
    const W = GRID.w * u;
    const H = GRID.h * u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // fundo, grade e moldura são estáticos: desenhados uma vez numa camada própria (otimização 01/11: antes refeitos
    // a cada quadro com sombra, o que derrubava o FPS em celular fraco)
    const key = `${W}x${H}x${this.dpr}x${this.cfg?.mode ?? ''}`;
    if (!this.bgLayer || this.bgKey !== key) {
      this.bgKey = key;
      this.bgLayer = document.createElement('canvas');
      this.bgLayer.width = this.cv.width;
      this.bgLayer.height = this.cv.height;
      this.paintStatic(this.bgLayer.getContext('2d')!, W, H, u);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgLayer, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const s = this.s;
    if (s) {
      // rastros: linha vetorial pelo trajeto cronológico real (centro de cada célula), cantos arredondados só dentro
      // da própria célula (raio = meia espessura) e brilho em camadas. Não muda o caminho nem as colisões (grade).
      for (const p of [0, 1] as const) {
        const col = PLAYER_COLORS[p];
        const path = s.paths[p];
        if (path.length < 1) continue;
        // só os cantos (pontos onde a direção muda) + pontas
        const pts: [number, number][] = [];
        for (let i = 0; i < path.length; i++) {
          const x = (path[i] % GRID.w) + 0.5;
          const y = ((path[i] / GRID.w) | 0) + 0.5;
          if (i > 0 && i < path.length - 1) {
            const px = (path[i - 1] % GRID.w) + 0.5;
            const py = ((path[i - 1] / GRID.w) | 0) + 0.5;
            const nx = (path[i + 1] % GRID.w) + 0.5;
            const ny = ((path[i + 1] / GRID.w) | 0) + 0.5;
            if (x - px === nx - x && y - py === ny - y) continue;
          }
          pts.push([x * u, y * u]);
        }
        const stroke = (w: number, style: string, alpha: number, blur: number) => {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = style;
          ctx.lineWidth = w;
          ctx.shadowColor = col;
          ctx.shadowBlur = blur;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
          ctx.stroke();
        };
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // brilho em camadas de traço largo e transparente (sem shadowBlur: custava ~3× mais por quadro)
        stroke(u * 1.5, col, 0.08, 0);
        stroke(u * 1.0, col, 0.18, 0); // halo largo
        stroke(u * 0.56, col, 1, 0); // corpo do rastro
        stroke(u * 0.16, '#ffffff', 0.75, 0); // filete claro no centro
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
      // cabeças (motos)
      for (const p of [0, 1] as const) {
        const b = s.bikes[p];
        const cx = (b.x + 0.5) * u;
        const cy = (b.y + 0.5) * u;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((b.dir * Math.PI) / 2);
        ctx.shadowColor = PLAYER_COLORS[p];
        ctx.shadowBlur = u * 1.4;
        ctx.fillStyle = b.alive ? '#ffffff' : 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(0, -u * 0.75);
        ctx.lineTo(u * 0.5, u * 0.45);
        ctx.lineTo(-u * 0.5, u * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // seta de direção durante a contagem
        if (this.countdown > 0) {
          ctx.fillStyle = PLAYER_COLORS[p];
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 8);
          for (let k = 2; k <= 4; k++) {
            ctx.beginPath();
            ctx.arc(cx + DX[b.dir] * k * u, cy + DY[b.dir] * k * u, u * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      this.fx.draw(ctx);
      if (this.countdown > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `800 ${Math.round(u * 6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.max(1, Math.ceil(this.countdown))), W / 2, H / 2);
      }
    }
  }

  /** Para testes no navegador. */
  debug() {
    return { mode: this.cfg?.mode, result: this.s?.result ?? null, steps: this.s?.steps ?? 0, rounds: this.match.rounds, bikes: this.s?.bikes.map((b) => ({ x: b.x, y: b.y, dir: b.dir, alive: b.alive })), countdown: this.countdown };
  }
}

const trails: GameModule = {
  mount(container, { onExit }) {
    const g = new TrailsGame(container, onExit);
    (window as unknown as { __trails?: TrailsGame }).__trails = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __trails?: TrailsGame }).__trails;
      },
    };
  },
};
export default trails;
