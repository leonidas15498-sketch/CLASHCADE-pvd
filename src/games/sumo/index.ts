import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { SumoAI } from './ai';
import { createSumo, dash, ringRadius, setInput, stepSumo, SUMO, SumoState } from './logic';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> empurrar o rival para fora do ringue. Quem vencer <b>${SUMO.roundsToWin} rounds</b> leva a partida.</li>
<li><b>Mover:</b> encoste o dedo na sua metade da tela e arraste: o lutador vai para onde você puxar (joystick que nasce onde você toca).</li>
<li><b>Avanço ⚡:</b> toque rápido (sem arrastar) dá um tranco para a frente. Recarrega em ~1 s (anel em volta do lutador).</li>
<li>Os dois saindo juntos anula o round. Depois de ${SUMO.shrinkStart} s o ringue começa a encolher; aos ${SUMO.roundTime} s vence quem estiver mais perto do centro.</li>
<li><b>2 jogadores:</b> ao mesmo tempo, cada um na sua metade (celular em pé: coral embaixo, azul em cima; deitado: coral à esquerda).</li>
<li><b>Teclado:</b> Jogador 1 com W A S D e espaço (avanço); Jogador 2 com as setas e Enter.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> push your rival out of the ring. First to win <b>${SUMO.roundsToWin} rounds</b> takes the match.</li>
<li><b>Move:</b> touch your half of the screen and drag: your wrestler goes where you pull (a joystick appears where you touch).</li>
<li><b>Dash ⚡:</b> a quick tap (no drag) lunges forward. Recharges in ~1 s (ring around the wrestler).</li>
<li>Both going out together cancels the round. After ${SUMO.shrinkStart} s the ring starts shrinking; at ${SUMO.roundTime} s whoever is closer to the center wins.</li>
<li><b>2 players:</b> at the same time, each on their own half (portrait: coral at the bottom, blue on top; landscape: coral on the left).</li>
<li><b>Keyboard:</b> Player 1 with W A S D and space (dash); Player 2 with the arrows and Enter.</li>
</ul>`;

/** Joystick: distância (px) do toque até a força máxima. */
const STICK_PX = 46;

interface Stick {
  id: number;
  p: 0 | 1;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t0: number;
  moved: boolean;
  /** Segundo dedo do mesmo jogador: só serve para avanço. */
  tapOnly: boolean;
}

class SumoGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: SumoState | null = null;
  private cfg: StartConfig | null = null;
  private ai: SumoAI | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private dpr = 1;
  private sc = 100;
  private cx = 0;
  private cy = 0;
  private portrait = false;
  private disposed = false;
  private sticks = new Map<number, Stick>();
  private keys = new Set<string>();
  private fx = new ParticleSystem();
  private evIdx = 0;
  private ac = new AbortController();
  private shakeT = 0;
  private shakeAmp = 0;
  private trail: Array<{ p: 0 | 1; x: number; y: number; t: number }> = [];
  private stats = { hits: 0, dashes: 0, outs: 0 };
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'sumo',
      title: T('Sumô Neon', 'Neon Sumo'),
      subtitle: T('Empurre o rival para fora do ringue', 'Push your rival out of the ring'),
      modes: { ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo, cada um na sua metade da tela.', 'Both play at once, each on their own half of the screen.'),
      // música do Leon (Gemini): "The Final Bout", detalhes em docs/jogos/sumo.md
      musicUrl: './music/the-final-bout.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => this.start(cfg),
      onPause: (p) => {
        this.keys.clear(); this.sticks.clear();
        if (this.s) { setInput(this.s, 0, 0, 0); setInput(this.s, 1, 0, 0); }
        if (!p) this.last = performance.now();
      },
      onRestart: () => this.cfg && this.start(this.cfg),
      onMenu: () => {
        this.s = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Ringue de sumô', 'Sumo ring'));
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
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.s = createSumo();
    this.ai = cfg.mode === 'ai' ? new SumoAI(cfg.difficulty, 1) : null;
    this.evIdx = 0;
    this.sticks.clear();
    this.fx.clear();
    this.trail = [];
    this.stats = { hits: 0, dashes: 0, outs: 0 };
    this.shell.setTurn(null);
    this.shell.toast(T('Arraste para mover, toque rápido para avançar ⚡', 'Drag to move, quick tap to dash ⚡'), 2600);
    this.paintHud();
  }

  private paintHud() {
    const s = this.s;
    const n = this.cfg?.names ?? ['', ''];
    this.shell.setScore(s ? Shell.pill(0, n[0], s.wins[0], true) + Shell.pill(1, n[1], s.wins[1], true) : '');
    if (s) this.shell.setSubtitle(`${T('Round', 'Round')} ${s.round} · ${T('melhor de 3', 'best of 3')}`);
  }

  // ------------------------------------------------------------ entrada
  /** De quem é o toque: contra a IA, a tela toda é do J1; no 2P, cada metade (em pé: J2 em cima). */
  private owner(clientX: number, clientY: number): 0 | 1 {
    if (this.cfg?.mode !== 'local') return 0;
    const r = this.cv.getBoundingClientRect();
    return this.portrait ? (clientY < r.top + r.height / 2 ? 1 : 0) : clientX > r.left + r.width / 2 ? 1 : 0;
  }

  /** Vetor de tela (px) → vetor do mundo. Em pé, o mundo gira 90° (J1 embaixo). */
  private screenVec(dx: number, dy: number): [number, number] {
    return this.portrait ? [-dy, dx] : [dx, dy];
  }

  private applyStick(st: Stick) {
    if (!this.s || st.tapOnly) return;
    const [wx, wy] = this.screenVec(st.x - st.x0, st.y - st.y0);
    setInput(this.s, st.p, wx / STICK_PX, wy / STICK_PX);
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const area = this.shell.stage;
    area.addEventListener(
      'pointerdown',
      (e) => {
        this.shell.sfx.unlock();
        if (!this.s || this.shell.paused) return;
        const p = this.owner(e.clientX, e.clientY);
        if (this.ai && p === 1) return;
        const busy = [...this.sticks.values()].some((x) => x.p === p && !x.tapOnly);
        this.sticks.set(e.pointerId, { id: e.pointerId, p, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, tapOnly: busy });
        try {
          area.setPointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
      },
      sig,
    );
    area.addEventListener(
      'pointermove',
      (e) => {
        const st = this.sticks.get(e.pointerId);
        if (!st) return;
        st.x = e.clientX;
        st.y = e.clientY;
        if (Math.hypot(st.x - st.x0, st.y - st.y0) > 10) st.moved = true;
        this.applyStick(st);
      },
      sig,
    );
    const up = (e: PointerEvent) => {
      const st = this.sticks.get(e.pointerId);
      if (!st) return;
      this.sticks.delete(e.pointerId);
      if (!this.s) return;
      // toque rápido sem arrastar = avanço
      if (e.type === 'pointerup' && !st.moved && performance.now() - st.t0 < 260) this.tryDash(st.p);
      if (!st.tapOnly) {
        // se o jogador ainda tem outro dedo, ele vira o joystick; senão para de acelerar
        const other = [...this.sticks.values()].find((x) => x.p === st.p);
        if (other) {
          other.tapOnly = false;
          other.x0 = other.x;
          other.y0 = other.y;
        }
        setInput(this.s, st.p, 0, 0);
      }
    };
    area.addEventListener('pointerup', up, sig);
    area.addEventListener('pointercancel', up, sig);
    window.addEventListener(
      'keydown',
      (e) => {
        const k = e.key.toLowerCase();
        if (this.shell.paused || this.shell.overlayOpen()) return;
        this.keys.add(k);
        if (!this.s || this.shell.paused) return;
        if (k === ' ') {
          this.tryDash(0);
          e.preventDefault();
        } else if (k === 'enter') {
          this.tryDash(this.cfg?.mode === 'local' ? 1 : 0);
          e.preventDefault();
        }
      },
      sig,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), sig);
  }

  private tryDash(p: 0 | 1) {
    if (this.s && !this.shell.paused && !this.shell.overlayOpen() && dash(this.s, p)) this.stats.dashes++;
  }

  private keyInput() {
    const s = this.s!;
    const k = this.keys;
    const kv = (u: string, d: string, l: string, r: string): [number, number] | null => {
      const x = (k.has(r) ? 1 : 0) - (k.has(l) ? 1 : 0);
      const y = (k.has(d) ? 1 : 0) - (k.has(u) ? 1 : 0);
      return x || y ? this.screenVec(x, y) : null;
    };
    const hasStick = (p: 0 | 1) => [...this.sticks.values()].some((x) => x.p === p && !x.tapOnly);
    const a = kv('w', 's', 'a', 'd');
    const b = kv('arrowup', 'arrowdown', 'arrowleft', 'arrowright');
    if (this.cfg?.mode === 'local') {
      if (!hasStick(0)) setInput(s, 0, ...(a ?? [0, 0]));
      if (!hasStick(1)) setInput(s, 1, ...(b ?? [0, 0]));
    } else if (!hasStick(0)) setInput(s, 0, ...(a ?? b ?? [0, 0]));
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    const s = this.s;
    if (s && !this.shell.paused) {
      if (this.keys.size) this.keyInput();
      this.acc += dt;
      let n = 0;
      while (this.acc >= SUMO.dt && n < 20) {
        this.ai?.update(s, SUMO.dt);
        stepSumo(s);
        this.acc -= SUMO.dt;
        n++;
      }
      this.handleEvents();
      for (const p of [0, 1] as const) {
        const w = s.w[p];
        if (Math.hypot(w.vx, w.vy) > 1.9) this.trail.push({ p, x: w.x, y: w.y, t: s.t });
      }
      while (this.trail.length && s.t - this.trail[0].t > 0.16) this.trail.shift();
    }
    if (!this.shell.paused) {
      this.fx.update(dt);
      this.shakeT = Math.max(0, this.shakeT - dt);
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private handleEvents() {
    const s = this.s!;
    const n = this.cfg!.names;
    for (; this.evIdx < s.events.length; this.evIdx++) {
      const e = s.events[this.evIdx];
      if (e.type === 'hit') {
        this.stats.hits++;
        const k = Math.min(1, (e.power - 0.4) / 2.6);
        this.shell.sfx.noise(320 - 120 * k, 0.07, 0.15 + 0.3 * k, 1.2);
        this.shell.sfx.tone(120, 0.08, 0.12 + 0.2 * k, 'sine', 0.6);
        this.fx.burst('simples', e.x, e.y, 0.2 + 0.15 * k);
        if (e.power > 1.4) {
          this.shakeAmp = 2 + 2 * k;
          this.shakeT = 0.08;
        }
      } else if (e.type === 'dash') this.shell.sfx.tone(380, 0.09, 0.12, 'triangle', 1.8);
      else if (e.type === 'out' || e.type === 'timeout') {
        this.stats.outs++;
        const winner = e.type === 'out' ? (e.loser === 'both' ? null : ((1 - e.loser) as 0 | 1)) : e.winner;
        if (e.type === 'out') this.fx.burst('confete', e.x, e.y, 0.15);
        this.shell.setTurn(winner);
        this.paintHud();
        if (s.winner !== null) {
          const w = s.winner;
          const ai = this.cfg!.mode === 'ai';
          this.shell.report(this.cfg!, w);
          if (ai && w === 1) this.shell.sfx.lose();
          else this.shell.sfx.win();
          setTimeout(() => {
            if (this.disposed || this.s !== s) return;
            this.shell.showResult(ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`, `${n[0]} ${s.wins[0]} × ${s.wins[1]} ${n[1]}`, () => this.start(this.cfg!));
          }, 1100);
        } else {
          this.shell.sfx.tone(260, 0.25, 0.2, 'triangle', 0.6);
          const msg =
            winner === null
              ? e.type === 'out'
                ? T('Os dois saíram: round anulado!', 'Both out: round cancelled!')
                : T('Empate no tempo: repete o round', 'Draw on time: replay the round')
              : e.type === 'timeout'
                ? `${T('Tempo! Mais perto do centro:', 'Time! Closest to the center:')} ${n[winner]}`
                : `${T('Round para', 'Round to')} ${n[winner]}! ${s.wins[0]} × ${s.wins[1]}`;
          this.shell.toast(msg, 1200);
        }
      } else if (e.type === 'round') {
        this.shell.setTurn(null);
        this.paintHud();
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
    const W = st.clientWidth - 12;
    const H = st.clientHeight - 10;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.style.width = `${W}px`;
    this.cv.style.height = `${H}px`;
    this.cv.width = Math.floor(W * this.dpr);
    this.cv.height = Math.floor(H * this.dpr);
    this.portrait = H > W * 1.05;
    // ringue ocupa ~78% da menor dimensão (sobra borda para ver quem saiu)
    this.sc = (Math.min(W, H) * 0.39) / SUMO.ringR;
    this.cx = W / 2;
    this.cy = H / 2;
  }

  private worldTransform(sx = 0, sy = 0) {
    const d = this.dpr;
    const sc = this.sc;
    if (this.portrait) this.ctx.setTransform(0, -d * sc, d * sc, 0, d * (this.cx + sx), d * (this.cy + sy));
    else this.ctx.setTransform(d * sc, 0, 0, d * sc, d * (this.cx + sx), d * (this.cy + sy));
  }

  private draw() {
    const ctx = this.ctx;
    const W = this.cv.width / this.dpr;
    const H = this.cv.height / this.dpr;
    // fundo estático numa camada própria (desenhado só quando muda tamanho/modo): degradê de tela inteira por quadro
    // derrubava o FPS no celular em pé (qa/fps.cjs, CPU 4× mais lenta: 30 fps)
    const key = `${this.cv.width}x${this.cv.height}|${this.cfg?.mode}`;
    if (!this.bg || this.bgKey !== key) {
      this.bgKey = key;
      this.bg = document.createElement('canvas');
      this.bg.width = this.cv.width;
      this.bg.height = this.cv.height;
      const b = this.bg.getContext('2d')!;
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.paintBg(b, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawWorld(W, H);
  }

  private paintBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#13204d');
    g.addColorStop(1, '#070e26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // metades no 2P: leve tinta da cor de cada jogador
    if (this.cfg?.mode === 'local') {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = PLAYER_COLORS[0];
      if (this.portrait) ctx.fillRect(0, H / 2, W, H / 2);
      else ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = PLAYER_COLORS[1];
      if (this.portrait) ctx.fillRect(0, 0, W, H / 2);
      else ctx.fillRect(W / 2, 0, W / 2, H);
      ctx.globalAlpha = 1;
    }
  }

  private drawWorld(W: number, H: number) {
    const ctx = this.ctx;
    const sk = this.shakeT > 0 ? this.shakeAmp * (this.shakeT / 0.08) : 0;
    this.worldTransform(sk ? (Math.random() * 2 - 1) * sk : 0, sk ? (Math.random() * 2 - 1) * sk : 0);
    const s = this.s;
    const R = s ? ringRadius(s.rt) : SUMO.ringR;
    // piso do ringue
    const fg = ctx.createRadialGradient(0, 0, 0.1, 0, 0, SUMO.ringR * 1.08);
    fg.addColorStop(0, '#1c2a5e');
    fg.addColorStop(1, '#0d1638');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, SUMO.ringR * 1.08, 0, Math.PI * 2);
    ctx.fill();
    // linhas de largada (shikiri-sen estilizadas)
    ctx.lineCap = 'round';
    for (const [x, c] of [[-0.22, PLAYER_COLORS[0]], [0.22, PLAYER_COLORS[1]]] as const) {
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(x, -0.12);
      ctx.lineTo(x, 0.12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // borda neon (ciano) + borda atual encolhendo (âmbar)
    const ring = (r: number, col: string, w: number) => {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = w * 4;
      ctx.globalAlpha = 0.18;
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.globalAlpha = 1;
      ctx.stroke();
    };
    ring(SUMO.ringR, R < SUMO.ringR - 1e-3 ? 'rgba(0,224,255,0.35)' : '#00e0ff', 0.03);
    if (R < SUMO.ringR - 1e-3) ring(R, '#ffc24a', 0.035 + 0.01 * Math.sin((s?.t ?? 0) * 12));
    if (!s) return;
    // rastro do avanço
    for (const t of this.trail) {
      const k = 1 - (s.t - t.t) / 0.16;
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = PLAYER_COLORS[t.p];
      ctx.beginPath();
      ctx.arc(t.x, t.y, SUMO.bodyR * (0.6 + 0.4 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of [0, 1] as const) this.drawWrestler(p, s);
    this.fx.draw(ctx);
    // joysticks (pixels de tela)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const st of this.sticks.values()) {
      if (st.tapOnly) continue;
      const c = PLAYER_COLORS[st.p];
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(st.x0 - this.cv.getBoundingClientRect().left, st.y0 - this.cv.getBoundingClientRect().top, STICK_PX, 0, Math.PI * 2);
      ctx.stroke();
      const r = this.cv.getBoundingClientRect();
      let dx = st.x - st.x0;
      let dy = st.y - st.y0;
      const m = Math.hypot(dx, dy);
      if (m > STICK_PX) {
        dx *= STICK_PX / m;
        dy *= STICK_PX / m;
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(st.x0 - r.left + dx, st.y0 - r.top + dy, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // contagem antes do round
    if (s.freeze > 0 && s.winner === null) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `900 ${Math.round(this.sc * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.freeze > 0.35 ? String(Math.ceil((s.freeze - 0.35) / 0.25)) : T('JÁ!', 'GO!'), W / 2, H / 2);
    }
    // relógio do round (canto)
    if (s.freeze <= 0 && s.between <= 0 && s.winner === null) {
      const left = Math.max(0, SUMO.roundTime - s.rt);
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = left < SUMO.roundTime - SUMO.shrinkStart ? '#ffc24a' : 'rgba(255,255,255,0.75)';
      ctx.fillText(`⏱ ${Math.ceil(left)} s`, 12, 10);
    }
  }

  private drawWrestler(p: 0 | 1, s: SumoState) {
    const ctx = this.ctx;
    const w = s.w[p];
    const r = SUMO.bodyR;
    const c = PLAYER_COLORS[p];
    // halo
    const halo = ctx.createRadialGradient(w.x, w.y, r * 0.6, w.x, w.y, r * 1.8);
    halo.addColorStop(0, c + '88');
    halo.addColorStop(1, c + '00');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // corpo
    const body = ctx.createRadialGradient(w.x - r * 0.3, w.y - r * 0.3, r * 0.1, w.x, w.y, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.25, c);
    body.addColorStop(1, p === 0 ? '#8c2a17' : '#173f8c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
    ctx.fill();
    // faixa (mawashi estilizada) e olhos na direção em que olha
    const a = Math.atan2(w.fy, w.fx);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(10,20,51,0.55)';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    for (const ey of [-0.32, 0.32]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.45, ey * r, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a1433';
      ctx.beginPath();
      ctx.arc(r * 0.53, ey * r, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // recarga do avanço: arco que se completa
    const k = 1 - w.cd / SUMO.dashCd;
    ctx.strokeStyle = k >= 1 ? '#ffc24a' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r * 1.28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s
      ? {
          round: s.round,
          wins: [...s.wins],
          winner: s.winner,
          freeze: s.freeze,
          rt: s.rt,
          w: s.w.map((w) => ({ x: w.x, y: w.y, vx: w.vx, vy: w.vy, ix: w.ix, iy: w.iy, cd: w.cd })),
          portrait: this.portrait,
          stats: { ...this.stats },
          sticks: this.sticks.size,
        }
      : null;
  }
}

const sumo: GameModule = {
  mount(container, { onExit }) {
    const g = new SumoGame(container, onExit);
    (window as unknown as { __sumo?: SumoGame }).__sumo = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __sumo?: SumoGame }).__sumo;
      },
    };
  },
};
export default sumo;
