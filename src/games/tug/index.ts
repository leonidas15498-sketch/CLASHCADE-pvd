import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { TugAI } from './ai';
import { advance, bpmAt, createTug, Judge, nearestBeat, tap, TUG, TugState } from './logic';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> puxar a corda até a marca do seu lado. Aos ${TUG.maxTime} s vence quem estiver com a corda do seu lado.</li>
<li><b>Como puxar:</b> toque na sua metade da tela <b>no tempo da batida</b> (o anel fecha sobre o círculo e o tambor bate).</li>
<li><b>Perfeito</b> puxa mais que <b>Bom</b>; acertos seguidos fazem combo (até ×1,5).</li>
<li>Tocar fora do tempo ou duas vezes na mesma batida faz você <b>escorregar</b> e zera o combo: metralhar o botão não funciona.</li>
<li>A batida acelera aos poucos (de ${TUG.bpm0} para ${TUG.bpm1} batidas por minuto).</li>
<li><b>2 jogadores:</b> ao mesmo tempo, cada um na sua metade (celular em pé: coral embaixo, azul em cima; deitado: coral à esquerda).</li>
<li><b>Teclado:</b> Jogador 1 com A ou espaço; Jogador 2 com L ou Enter. Fone Bluetooth atrasa o som: prefira o alto-falante.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> pull the rope to the mark on your side. At ${TUG.maxTime} s whoever has the rope on their side wins.</li>
<li><b>How to pull:</b> tap your half of the screen <b>on the beat</b> (the ring closes on the circle and the drum hits).</li>
<li><b>Perfect</b> pulls more than <b>Good</b>; hits in a row build a combo (up to ×1.5).</li>
<li>Tapping off the beat or twice on the same beat makes you <b>slip</b> and resets the combo: mashing does not work.</li>
<li>The beat speeds up little by little (from ${TUG.bpm0} to ${TUG.bpm1} beats per minute).</li>
<li><b>2 players:</b> at the same time, each on their own half (portrait: coral at the bottom, blue on top; landscape: coral on the left).</li>
<li><b>Keyboard:</b> Player 1 with A or space; Player 2 with L or Enter. Bluetooth headphones delay the sound: prefer the speaker.</li>
</ul>`;

const JUDGE_TXT: Record<Judge, [string, string]> = {
  perfect: ['Perfeito!', 'Perfect!'],
  good: ['Bom', 'Good'],
  off: ['Fora!', 'Off!'],
  double: ['Fora!', 'Off!'],
};
/** Geometria (frações do eixo da corda): onde ficam os puxadores e quanto a corda anda até a marca de vitória. */
const PULLER = 0.8;
const SHIFT = 0.45;

const JUDGE_COL: Record<Judge, string> = { perfect: '#ffc24a', good: '#ffffff', off: '#ff5a67', double: '#ff5a67' };

class TugGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private s: TugState | null = null;
  private cfg: StartConfig | null = null;
  private ai: TugAI | null = null;
  private raf = 0;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private portrait = false;
  private disposed = false;
  private fx = new ParticleSystem();
  private ac = new AbortController();
  /** Relógio da partida: performance.now() do início (ajustado ao despausar). */
  private t0 = 0;
  private pausedAt = 0;
  private evIdx = 0;
  /** Batidas cujo som já foi agendado. */
  private soundBeat = 0;
  private ropeShown = 0;
  private pops: Array<{ p: 0 | 1; txt: string; col: string; t: number }> = [];
  private flashP: [number, number] = [0, 0];
  private ended = false;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'tug',
      title: T('Cabo de Guerra', 'Tug of War'),
      subtitle: T('Puxe no ritmo da batida', 'Pull on the beat'),
      modes: { ai: true, local: true },
      localNote: T('Os dois jogam ao mesmo tempo, cada um na sua metade da tela.', 'Both play at once, each on their own half of the screen.'),
      // música: pacote em docs/jogos/cabo-de-guerra.md (aguardando o Leon gerar no Gemini)
      musicUrl: null,
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => this.start(cfg),
      onPause: (p) => {
        if (p) this.pausedAt = performance.now();
        else if (this.pausedAt) {
          // despausar: o relógio continua de onde parou e as batidas que passariam durante a pausa não contam
          this.t0 += performance.now() - this.pausedAt;
          this.pausedAt = 0;
        }
      },
      onRestart: () => this.cfg && this.start(this.cfg),
      onMenu: () => {
        this.s = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Cabo de guerra', 'Tug of war'));
    this.cv.style.touchAction = 'none';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.bindInput();
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  private now() {
    return (performance.now() - this.t0) / 1000;
  }

  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.s = createTug();
    this.ai = cfg.mode === 'ai' ? new TugAI(cfg.difficulty, 1) : null;
    this.t0 = performance.now();
    this.pausedAt = 0;
    this.evIdx = 0;
    this.soundBeat = 0;
    this.ropeShown = 0;
    this.pops = [];
    this.ended = false;
    this.fx.clear();
    this.shell.setTurn(null);
    this.paintHud();
  }

  private paintHud() {
    const s = this.s;
    const n = this.cfg?.names ?? ['', ''];
    this.shell.setScore(s ? Shell.pill(0, n[0], `×${(1 + TUG.comboStep * Math.min(TUG.comboMax, s.combo[0])).toFixed(1)}`, s.rope <= 0) + Shell.pill(1, n[1], `×${(1 + TUG.comboStep * Math.min(TUG.comboMax, s.combo[1])).toFixed(1)}`, s.rope >= 0) : '');
  }

  // ------------------------------------------------------------ entrada
  private owner(clientX: number, clientY: number): 0 | 1 {
    if (this.cfg?.mode !== 'local') return 0;
    const r = this.cv.getBoundingClientRect();
    return this.portrait ? (clientY < r.top + r.height / 2 ? 1 : 0) : clientX > r.left + r.width / 2 ? 1 : 0;
  }

  /** Converte o carimbo de tempo do evento (mesma base de performance.now) para o relógio da partida. */
  private evTime(e: Event) {
    const ts = e.timeStamp > 1e12 ? performance.now() : e.timeStamp || performance.now();
    return (Math.min(ts, performance.now()) - this.t0) / 1000;
  }

  private doTap(p: 0 | 1, t: number) {
    const s = this.s;
    if (!s || s.over || this.shell.paused) return;
    if (this.ai && p === 1) return;
    tap(s, p, t);
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const area = this.shell.stage;
    area.addEventListener(
      'pointerdown',
      (e) => {
        this.shell.sfx.unlock();
        if (!this.s) return;
        this.doTap(this.owner(e.clientX, e.clientY), this.evTime(e));
      },
      sig,
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.repeat || !this.s) return;
        const k = e.key.toLowerCase();
        const local = this.cfg?.mode === 'local';
        if (k === 'a' || k === ' ') this.doTap(0, this.evTime(e));
        else if (k === 'l' || k === 'enter') this.doTap(local ? 1 : 0, this.evTime(e));
        else return;
        e.preventDefault();
      },
      sig,
    );
  }

  // --------------------------------------------------------------- laço
  private frame() {
    if (this.disposed) return;
    this.shell.sfx.frame();
    const s = this.s;
    if (s && !this.shell.paused) {
      const t = this.now();
      this.ai?.update(s, t);
      advance(s, t);
      this.scheduleSound(s, t);
      this.handleEvents(s);
      // corda desenhada persegue a real (mola rápida, 1/e em ~70 ms)
      this.ropeShown += (s.rope - this.ropeShown) * Math.min(1, (1 / 60) * 14);
      this.fx.update(1 / 60);
      this.flashP = [Math.max(0, this.flashP[0] - 1 / 60), Math.max(0, this.flashP[1] - 1 / 60)];
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  /** Agenda o tambor de cada batida com até 120 ms de antecedência no relógio de áudio (som não atrasa com o quadro). */
  private scheduleSound(s: TugState, t: number) {
    while (this.soundBeat < s.beats.length && s.beats[this.soundBeat] < t + 0.12) {
      const d = s.beats[this.soundBeat] - t;
      if (d > -0.03 && !s.over) {
        const accent = this.soundBeat % 4 === 0;
        this.shell.sfx.tone(accent ? 95 : 80, 0.12, accent ? 0.42 : 0.32, 'sine', 0.5, Math.max(0, d));
        if (accent) this.shell.sfx.tone(1600, 0.03, 0.05, 'square', 1, Math.max(0, d));
      }
      this.soundBeat++;
    }
  }

  private handleEvents(s: TugState) {
    const n = this.cfg!.names;
    let hud = false;
    for (; this.evIdx < s.events.length; this.evIdx++) {
      const e = s.events[this.evIdx];
      if (e.type === 'tap') {
        hud = true;
        this.pops.push({ p: e.p, txt: T(...JUDGE_TXT[e.judge]), col: JUDGE_COL[e.judge], t: this.now() });
        if (this.pops.length > 8) this.pops.shift();
        if (e.judge === 'perfect' || e.judge === 'good') {
          this.flashP[e.p] = 0.18;
          this.shell.sfx.noise(e.judge === 'perfect' ? 1400 : 900, 0.05, 0.16, 2);
          const [x, y] = this.handPos(e.p);
          this.fx.burst(e.judge === 'perfect' ? 'faiscas' : 'simples', x, y, 12); // pixels de tela
        } else this.shell.sfx.tone(160, 0.12, 0.14, 'sawtooth', 0.7);
      } else if (e.type === 'miss') hud = true;
      else if (e.type === 'end' && !this.ended) {
        this.ended = true;
        const w = e.winner;
        this.shell.setTurn(w);
        this.shell.report(this.cfg!, w === null ? 'draw' : w);
        const ai = this.cfg!.mode === 'ai';
        if (w === null || (ai && w === 1)) this.shell.sfx.lose();
        else this.shell.sfx.win();
        const st = s.stats;
        const acc = (p: 0 | 1) => {
          const tot = st[p].perfect + st[p].good + st[p].off + st[p].miss;
          return tot ? Math.round((100 * (st[p].perfect + st[p].good)) / tot) : 0;
        };
        setTimeout(() => {
          if (this.disposed || this.s !== s) return;
          const title = w === null ? T('Empate!', 'Draw!') : ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`;
          this.shell.showResult(title, `${T('Acertos no tempo', 'On-beat hits')}: ${n[0]} ${acc(0)}% · ${n[1]} ${acc(1)}% · ${T('perfeitos', 'perfects')} ${st[0].perfect} × ${st[1].perfect}`, () => this.start(this.cfg!));
        }, 1100);
      }
    }
    if (hud) this.paintHud();
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    this.W = st.clientWidth - 12;
    this.H = st.clientHeight - 10;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.style.width = `${this.W}px`;
    this.cv.style.height = `${this.H}px`;
    this.cv.width = Math.floor(this.W * this.dpr);
    this.cv.height = Math.floor(this.H * this.dpr);
    this.portrait = this.H > this.W * 1.05;
  }

  /** Eixo da corda: J1 em -1, J2 em +1. Em pé vai de baixo para cima; deitado da esquerda para a direita. */
  private toScreen(u: number, v = 0): [number, number] {
    const L = (this.portrait ? this.H : this.W) * 0.3;
    return this.portrait ? [this.W / 2 + v * L, this.H / 2 - u * L] : [this.W / 2 + u * L, this.H / 2 + v * L];
  }
  private handPos(p: 0 | 1): [number, number] {
    return this.toScreen((p === 0 ? -PULLER : PULLER) + (this.ropeShown / TUG.ropeWin) * SHIFT);
  }

  private draw() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    // fundo + marcas (estáticos) numa camada própria: redesenhar o degradê de tela inteira a cada quadro custava
    // ~30 fps no celular em pé (qa/fps.cjs, CPU 4× mais lenta)
    const key = `${this.cv.width}x${this.cv.height}|${this.portrait}`;
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
    this.drawPlay(W, H);
  }

  private paintBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const g = ctx.createLinearGradient(0, 0, this.portrait ? 0 : W, this.portrait ? H : 0);
    // lado de cada jogador levemente tingido: em pé azul em cima e coral embaixo; deitado coral à esquerda
    const coral = '#3a1a2c';
    const blue = '#13234d';
    g.addColorStop(0, this.portrait ? blue : coral);
    g.addColorStop(0.5, '#0a1433');
    g.addColorStop(1, this.portrait ? coral : blue);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // marcas de vitória (onde a fita precisa chegar) e linha do meio
    for (const [u, c] of [[-SHIFT, PLAYER_COLORS[0]], [SHIFT, PLAYER_COLORS[1]], [0, 'rgba(255,255,255,0.35)']] as const) {
      const [x1, y1] = this.toScreen(u, -0.28);
      const [x2, y2] = this.toScreen(u, 0.28);
      ctx.strokeStyle = c;
      ctx.lineWidth = u === 0 ? 2 : 4;
      ctx.setLineDash(u === 0 ? [6, 6] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawPlay(W: number, H: number) {
    const ctx = this.ctx;
    const s = this.s;
    const off = s ? this.ropeShown / TUG.ropeWin : 0; // -1..1
    // corda (desloca junto com a fita); pequenas tranças
    const shift = off * SHIFT;
    const [ax, ay] = this.toScreen(-1.05 + shift);
    const [bx, by] = this.toScreen(1.05 + shift);
    ctx.strokeStyle = '#c9a26b';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -20; i <= 20; i++) {
      const [x, y] = this.toScreen(i * 0.05 + shift, 0);
      if (this.portrait) {
        ctx.moveTo(x - 4, y - 2);
        ctx.lineTo(x + 4, y + 2);
      } else {
        ctx.moveTo(x - 2, y - 4);
        ctx.lineTo(x + 2, y + 4);
      }
    }
    ctx.stroke();
    // fita do meio da corda (âmbar)
    const [fx, fy] = this.toScreen(shift);
    ctx.fillStyle = '#ffc24a';
    ctx.beginPath();
    if (this.portrait) ctx.roundRect(fx - 22, fy - 7, 44, 14, 5);
    else ctx.roundRect(fx - 7, fy - 22, 14, 44, 5);
    ctx.fill();
    // puxadores (bolinhas com braços na corda), inclinam para trás no acerto
    for (const p of [0, 1] as const) {
      const lean = this.flashP[p] > 0 ? 0.05 : 0;
      const base = (p === 0 ? -PULLER : PULLER) + shift + (p === 0 ? -lean : lean);
      for (let k = 0; k < 2; k++) {
        const [x, y] = this.toScreen(base + (p === 0 ? -k * 0.14 : k * 0.14), 0);
        const r = Math.min(W, H) * 0.045;
        const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        body.addColorStop(0, '#fff');
        body.addColorStop(0.3, PLAYER_COLORS[p]);
        body.addColorStop(1, p === 0 ? '#7a2414' : '#163a80');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a1433';
        for (const e of [-0.3, 0.3]) {
          const [ex, ey] = this.portrait ? [x + e * r, y + (p === 0 ? -0.25 : 0.25) * r] : [x + (p === 0 ? 0.25 : -0.25) * r, y + e * r];
          ctx.beginPath();
          ctx.arc(ex, ey, r * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    this.fx.draw(ctx);
    if (!s) return;
    const t = this.now();
    // contagem antes da 1ª batida
    if (t < TUG.lead) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `900 ${Math.round(Math.min(W, H) * 0.14)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const left = TUG.lead - t;
      ctx.fillText(left > 0.6 ? String(Math.ceil((left - 0.6) / 0.6)) : T('PUXA!', 'PULL!'), W / 2, H / 2 - Math.min(W, H) * 0.18);
    }
    // alvo de ritmo de cada jogador: anel que fecha até a batida
    const k = nearestBeat(s, t);
    const next = s.beats[k] >= t ? k : k + 1;
    const period = 60 / bpmAt(next);
    const phase = Math.max(0, Math.min(1, (s.beats[next] - t) / period)); // 1 = acabou de bater, 0 = batendo agora
    const local = this.cfg!.mode === 'local';
    for (const p of [0, 1] as const) {
      // alvo fora da corda, perto do polegar de cada um (em pé: J1 embaixo à direita, J2 em cima à esquerda)
      const [cx, cy] = this.portrait ? [W / 2 + (p === 0 ? 1 : -1) * W * 0.26, p === 0 ? H * 0.82 : H * 0.18] : [p === 0 ? W * 0.17 : W * 0.83, H * 0.76];
      const R = Math.min(W * (this.portrait ? 0.12 : 0.07), H * 0.11);
      const pulse = Math.max(0, 1 - Math.abs(t - s.beats[k]) / 0.09);
      ctx.fillStyle = PLAYER_COLORS[p] + (pulse > 0 ? 'cc' : '55');
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1 + pulse * 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.35 + 0.65 * (1 - phase);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1 + phase * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // rótulo (o de cima fica de cabeça para baixo para quem está do outro lado)
      ctx.save();
      ctx.translate(cx, cy);
      if (this.portrait && p === 1 && local) ctx.rotate(Math.PI);
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(R * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.ai && p === 1 ? T('IA', 'AI') : T('PUXA', 'PULL'), 0, 0);
      // avaliação do último toque
      const pop = [...this.pops].reverse().find((q) => q.p === p);
      if (pop && t - pop.t < 0.6) {
        const a = 1 - (t - pop.t) / 0.6;
        ctx.globalAlpha = a;
        ctx.fillStyle = pop.col;
        ctx.font = `900 ${Math.round(R * 0.5)}px system-ui, sans-serif`;
        ctx.fillText(pop.txt, 0, -R * (1.7 + (1 - a) * 0.4));
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // relógio
    if (t >= TUG.lead && !s.over) {
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`⏱ ${Math.ceil(Math.max(0, TUG.maxTime - t))} s · ${Math.round(bpmAt(next))} BPM`, 12, 10);
    }
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s ? { t: this.now(), rope: s.rope, combo: [...s.combo], over: s.over, winner: s.winner, stats: s.stats.map((x) => ({ ...x })), nextBeat: s.beats.find((b) => b > this.now()) ?? null, portrait: this.portrait } : null;
  }
}

const tug: GameModule = {
  mount(container, { onExit }) {
    const g = new TugGame(container, onExit);
    (window as unknown as { __tug?: TugGame }).__tug = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __tug?: TugGame }).__tug;
      },
    };
  },
};
export default tug;
