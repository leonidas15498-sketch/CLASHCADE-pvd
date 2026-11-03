/**
 * Medidor de força padrão da plataforma (sinuca, minigolfe e próximos jogos).
 * Desenha numa única tela (canvas) por cima da barra lateral: tubo com moldura metálica, escala de LEDs
 * verde → âmbar → vermelho, o taco/instrumento do jogador descendo conforme a puxada e a animação da tacada
 * (o taco dispara para cima, passa um pouco do topo, clarão e onda). A lógica de entrada continua no jogo:
 * o medidor só mostra o estado (set/fire/cancel).
 */
import { onMountRollback } from './lifecycle';
export type ToolPainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const SEGMENTS = 20;
const STYLE_ID = 'jogaco-power-gauge';
const CSS = `.pg-on > :not(.pg-cv){visibility:hidden!important}
.pg-on{background:none!important;border:0!important;box-shadow:none!important;overflow:visible!important}
.pg-on::after{display:none!important}
.pg-cv{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}`;

let styleUsers = 0;

export class PowerGauge {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tool: HTMLCanvasElement | null = null;
  private painter: ToolPainter | null = null;
  private target = 0;
  private shown = 0;
  private vel = 0;
  private pulling = false;
  private locked = false;
  /** Tempo desde a última tacada (s); < FIRE_T = animação de disparo. */
  private fireT = 9;
  private firePower = 0;
  private cancelT = 9;
  private t = 0;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ro: ResizeObserver | null = null;
  private dirty = true;
  private disposed = false;

  constructor(private host: HTMLElement) {
    onMountRollback(() => this.dispose());
    if (styleUsers++ === 0 && !document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    host.classList.add('pg-on');
    this.cv = document.createElement('canvas');
    this.cv.className = 'pg-cv';
    this.cv.setAttribute('aria-hidden', 'true');
    host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
    }
    this.resize();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.cv?.remove();
    this.host.classList.remove('pg-on');
    if (--styleUsers === 0) document.getElementById(STYLE_ID)?.remove();
  }

  /** Taco/instrumento desenhado de pé (ponta/cabeça para cima) num retângulo w × h. */
  setTool(p: ToolPainter): void {
    this.painter = p;
    this.tool = null;
    this.dirty = true;
  }

  set(power: number, pulling: boolean): void {
    this.target = Math.max(0, Math.min(1, power));
    this.pulling = pulling;
    this.dirty = true;
  }

  setLocked(locked: boolean): void {
    if (locked !== this.locked) {
      this.locked = locked;
      this.dirty = true;
    }
  }

  /** Tacada: o taco dispara para o topo com a força atual. */
  fire(): void {
    this.firePower = Math.max(this.shown, this.target);
    this.fireT = 0;
    this.target = 0;
    this.pulling = false;
    this.vel = 0;
    this.dirty = true;
  }

  /** Cancelou (voltou ao topo sem tacar): o taco sobe devagar, sem clarão. */
  cancel(): void {
    this.cancelT = 0;
    this.target = 0;
    this.pulling = false;
    this.dirty = true;
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.tool = null;
    this.dirty = true;
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    const FIRE_T = 0.42;
    const animating = this.fireT < FIRE_T || this.cancelT < 0.3 || Math.abs(this.shown - this.target) > 0.001 || this.target > 0.85 || this.idleHint();
    if (this.fireT < FIRE_T) this.fireT += dt;
    if (this.cancelT < 0.3) this.cancelT += dt;
    // mola criticamente amortecida: acompanha o dedo sem atraso perceptível e sem tremer
    if (this.fireT >= FIRE_T) {
      const k = this.pulling ? 900 : this.cancelT < 0.3 ? 160 : 600;
      const c = 2 * Math.sqrt(k);
      this.vel += (k * (this.target - this.shown) - c * this.vel) * dt;
      this.shown += this.vel * dt;
      if (Math.abs(this.shown - this.target) < 0.0005 && Math.abs(this.vel) < 0.01) {
        this.shown = this.target;
        this.vel = 0;
      }
    } else this.shown = 0;
    if (animating || this.dirty) {
      this.draw();
      this.dirty = false;
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private idleHint() {
    return !this.locked && !this.pulling && this.target === 0 && this.fireT > 0.42;
  }

  private buildTool(tw: number, th: number) {
    if (!this.painter) return null;
    const c = document.createElement('canvas');
    c.width = Math.round(tw * this.dpr);
    c.height = Math.round(th * this.dpr);
    const g = c.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.painter(g, tw, th);
    return c;
  }

  private draw() {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const p = this.shown;
    const heat = Math.max(p, this.fireT < 0.42 ? this.firePower * (1 - this.fireT / 0.42) : 0);
    const R = Math.min(14, w * 0.32);

    // moldura metálica
    const bez = ctx.createLinearGradient(0, 0, w, 0);
    bez.addColorStop(0, '#4a4f57');
    bez.addColorStop(0.18, '#c9ced6');
    bez.addColorStop(0.5, '#6b717a');
    bez.addColorStop(0.82, '#d7dbe1');
    bez.addColorStop(1, '#3d4148');
    rr(ctx, 0.5, 0.5, w - 1, h - 1, R);
    ctx.fillStyle = bez;
    ctx.fill();
    // brilho externo de tensão
    if (heat > 0.02) {
      ctx.save();
      const pulse = heat > 0.85 ? 0.6 + 0.4 * Math.sin(this.t * 14) : 1;
      ctx.shadowColor = heatColor(heat, 0.9);
      ctx.shadowBlur = 6 + 16 * heat * pulse;
      ctx.strokeStyle = heatColor(heat, 0.85);
      ctx.lineWidth = 1.5;
      rr(ctx, 0.5, 0.5, w - 1, h - 1, R);
      ctx.stroke();
      ctx.restore();
    }
    // tubo interno
    const inset = Math.max(3, w * 0.09);
    const ix = inset;
    const iy = inset;
    const iw = w - inset * 2;
    const ih = h - inset * 2;
    const tube = ctx.createLinearGradient(ix, 0, ix + iw, 0);
    tube.addColorStop(0, '#05070a');
    tube.addColorStop(0.5, '#151a22');
    tube.addColorStop(1, '#05070a');
    rr(ctx, ix, iy, iw, ih, R - inset * 0.6);
    ctx.fillStyle = tube;
    ctx.fill();

    ctx.save();
    rr(ctx, ix, iy, iw, ih, R - inset * 0.6);
    ctx.clip();

    // escala de LEDs (dois trilhos, um de cada lado)
    const segGap = 2;
    const top = iy + 6;
    const bottom = iy + ih - 6;
    const segH = (bottom - top - segGap * (SEGMENTS - 1)) / SEGMENTS;
    const ledW = Math.max(3, iw * 0.16);
    const lit = p * SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const y = top + i * (segH + segGap);
      const frac = (i + 1) / SEGMENTS;
      const on = Math.min(1, Math.max(0, lit - i));
      for (const x of [ix + 3, ix + iw - 3 - ledW]) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        rr(ctx, x, y, ledW, segH, 1.5);
        ctx.fill();
        if (on > 0) {
          ctx.save();
          ctx.globalAlpha = on;
          ctx.shadowColor = heatColor(frac, 1);
          ctx.shadowBlur = 8;
          ctx.fillStyle = heatColor(frac, 1);
          rr(ctx, x, y, ledW, segH, 1.5);
          ctx.fill();
          ctx.restore();
        }
      }
      // marcas de 25 %
      if ((i + 1) % 5 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(ix + 3 + ledW + 2, y + segH - 1, iw - 2 * (ledW + 5), 1);
      }
    }

    // indicação de "puxe" quando parado
    if (this.idleHint()) {
      const ph = (this.t % 1.8) / 1.8;
      const a = Math.sin(ph * Math.PI) * 0.55;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const cx = w / 2;
      for (let k = 0; k < 2; k++) {
        const y = iy + ih * (0.62 + ph * 0.12) + k * 9;
        ctx.beginPath();
        ctx.moveTo(cx - 5, y);
        ctx.lineTo(cx, y + 5);
        ctx.lineTo(cx + 5, y);
        ctx.stroke();
      }
    }

    // taco/instrumento
    const travel = ih * 0.62;
    let off = p * travel;
    let streak = 0;
    if (this.fireT < 0.42) {
      // disparo: sobe em ~70 ms, passa do topo e assenta
      const a = this.fireT;
      const start = this.firePower * travel;
      if (a < 0.07) {
        const k = a / 0.07;
        off = start * (1 - k * k);
        streak = this.firePower;
      } else {
        const k = (a - 0.07) / 0.35;
        off = -Math.sin(k * Math.PI) * Math.exp(-k * 3) * (8 + 14 * this.firePower);
      }
    }
    const tw = iw * 0.62;
    const th = ih * 1.3;
    if (!this.tool && this.painter) this.tool = this.buildTool(tw, th);
    const tx = w / 2 - tw / 2;
    const ty = iy + 3 + off;
    if (streak > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      for (let k = 1; k <= 3; k++) if (this.tool) ctx.drawImage(this.tool, tx, ty + k * 7 * streak, tw, th);
      ctx.restore();
    }
    if (this.tool) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(this.tool, tx, ty, tw, th);
      ctx.restore();
    }
    // vidro: reflexo vertical
    const glass = ctx.createLinearGradient(ix, 0, ix + iw, 0);
    glass.addColorStop(0, 'rgba(255,255,255,0)');
    glass.addColorStop(0.22, 'rgba(255,255,255,0.10)');
    glass.addColorStop(0.32, 'rgba(255,255,255,0)');
    ctx.fillStyle = glass;
    ctx.fillRect(ix, iy, iw, ih);
    // sombra interna
    const sh = ctx.createLinearGradient(0, iy, 0, iy + 18);
    sh.addColorStop(0, 'rgba(0,0,0,0.7)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(ix, iy, iw, 18);
    ctx.restore();

    // clarão e onda no topo ao tacar
    if (this.fireT < 0.42) {
      const k = this.fireT / 0.42;
      const cx = w / 2;
      const cy = iy + 4;
      ctx.save();
      ctx.globalAlpha = (1 - k) * (0.5 + 0.5 * this.firePower);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, heatColor(this.firePower, 0.6));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-w, -w, w * 3, w * 3);
      ctx.strokeStyle = heatColor(this.firePower, 1);
      ctx.lineWidth = 2.5 * (1 - k);
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + k * w * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.locked) {
      ctx.fillStyle = 'rgba(10,12,16,0.55)';
      rr(ctx, 0.5, 0.5, w - 1, h - 1, R);
      ctx.fill();
    }
  }
}

/** Verde (0) → âmbar (0,6) → vermelho (1). */
function heatColor(f: number, a: number) {
  const hue = f < 0.6 ? 130 - (f / 0.6) * 85 : 45 - ((f - 0.6) / 0.4) * 45;
  return `hsla(${hue.toFixed(0)}, 95%, ${f > 0.9 ? 58 : 52}%, ${a})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}
