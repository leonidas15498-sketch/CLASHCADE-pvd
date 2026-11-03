import { drawTrail, ParticleSystem, TrailId } from '../../shared/fx';
import { COURSE_THEMES, CourseTheme } from './courses';
import { moverSegments, sliderRect } from '../physics/sim';
import { GOLF, Level, Vec } from '../physics/types';
import { paintPutter, PutterSkin } from './putters';

/** Cores das bolas por jogador (anel de identificação). */
export { PLAYER_COLORS } from '../../shared/players';

export interface GolfBallView {
  x: number;
  y: number;
  color: string;
  active: boolean;
  /** 0..1 — encolhe ao cair no buraco. */
  scale: number;
  visible: boolean;
  /** Orientação visual (quatérnio) — faz as covinhas girarem quando a bola rola. */
  q: [number, number, number, number];
  /** 0..1 — escurece ao afundar no copo. */
  dark: number;
}

export interface Particle {
  x: number;
  y: number;
  color: string;
  size: number;
  rot: number;
}

export interface GolfRenderState {
  level: Level;
  t: number;
  balls: GolfBallView[];
  aim: { from: Vec; to: Vec; hit: boolean; after?: Vec | null } | null;
  /** Respingo de água (fora de campo). */
  splash: { x: number; y: number; age: number } | null;
  /** Rastro da bola em movimento (mais antigo → mais novo) e sua cor. */
  trail: { id: TrailId; pts: Vec[]; color: string } | null;
  /** Explosão do buraco (tema do campo). */
  fx?: ParticleSystem | null;
  /** Confete / brilhos. */
  particles: Particle[];
  /** Taco desenhado atrás da bola ativa (gap = distância da face ao centro da bola). */
  putter: { skin: PutterSkin; angle: number; gap: number; x: number; y: number } | null;
}

/** Renderização top-down com leve volume (paredes com face superior e sombra). Só desenho. */
export class GolfRenderer {
  private ctx: CanvasRenderingContext2D;
  scale = 10;
  ox = 0;
  oy = 0;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private bgLevel = -1;
  private theme: CourseTheme = COURSE_THEMES[0];

  /** Troca o visual do campo (refaz o fundo no próximo quadro). */
  setTheme(t: CourseTheme): void {
    if (t.id === this.theme.id) return;
    this.theme = t;
    this.bg = null;
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Enquadra o buraco inteiro na área disponível (mantém proporção). */
  resize(cssW: number, cssH: number, level: Level): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // otimização 01/11: 2,5 → 2 (56% menos pixels, nitidez igual a olho nu)
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    const b = level.bounds;
    this.scale = Math.min(cssW / b.w, cssH / b.h);
    this.ox = (cssW - b.w * this.scale) / 2 - b.x * this.scale;
    this.oy = (cssH - b.h * this.scale) / 2 - b.y * this.scale;
    this.bg = null;
  }

  toWorld(px: number, py: number): Vec {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  private world(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
  }

  private buildBackground(level: Level): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    // mar ao pôr do sol
    const sea = ctx.createLinearGradient(0, 0, 0, c.height);
    const th = this.theme;
    sea.addColorStop(0, th.sea[0]);
    sea.addColorStop(0.55, th.sea[1]);
    sea.addColorStop(1, th.sea[2]);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, c.width, c.height);
    const glow = ctx.createRadialGradient(c.width * 0.85, -c.height * 0.1, 10, c.width * 0.85, -c.height * 0.1, c.width * 0.7);
    glow.addColorStop(0, th.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
    this.world(ctx);
    const px = 1 / this.scale;
    // ondinhas
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = px * 1.5;
    const b = level.bounds;
    for (let i = 0; i < 70; i++) {
      const x = b.x - 10 + ((i * 37.7) % (b.w + 20));
      const y = b.y - 10 + ((i * 23.3) % (b.h + 20));
      ctx.beginPath();
      ctx.arc(x, y, 1.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    // ilha de areia em volta do gramado
    const poly = (pts: Vec[]) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    poly(level.green);
    ctx.strokeStyle = th.shore[0];
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.strokeStyle = th.shore[1];
    ctx.lineWidth = 6;
    ctx.stroke();
    // água das fases com ponte (desenhada por cima da areia)
    for (const z of level.zones) {
      if (z.kind !== 'water') continue;
      poly(z.poly);
      const g = ctx.createLinearGradient(0, z.poly[0].y, 0, z.poly[2].y);
      g.addColorStop(0, th.water[0]);
      g.addColorStop(1, th.water[1]);
      ctx.fillStyle = g;
      ctx.fill();
    }
    // sombra das paredes
    poly(level.green);
    ctx.save();
    ctx.translate(0.35, 0.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
    // paredes de madeira (borda externa); arestas abertas não têm parede
    const open = new Set(level.openEdges ?? []);
    level.green.forEach((a, i) => {
      if (open.has(i)) return;
      const bb = level.green[(i + 1) % level.green.length];
      ctx.lineCap = 'round';
      ctx.strokeStyle = th.wall[0];
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.stroke();
      ctx.strokeStyle = th.wall[1];
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 0.25);
      ctx.lineTo(bb.x, bb.y - 0.25);
      ctx.stroke();
    });
    // gramado com faixas
    ctx.save();
    poly(level.green);
    ctx.clip();
    ctx.fillStyle = th.grass[0];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = th.grass[1];
    for (let x = b.x - b.h; x < b.x + b.w; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x + 3, b.y);
      ctx.lineTo(x + 3 + b.h, b.y + b.h);
      ctx.lineTo(x + b.h, b.y + b.h);
      ctx.closePath();
      ctx.fill();
    }
    // zonas
    for (const z of level.zones) {
      if (z.kind === 'sand') {
        poly(z.poly);
        ctx.fillStyle = '#e8cf93';
        ctx.fill();
        ctx.fillStyle = 'rgba(160,120,60,0.35)';
        for (let i = 0; i < 40; i++) {
          const x = z.poly[0].x + ((i * 1.37) % (z.poly[1].x - z.poly[0].x));
          const y = z.poly[0].y + ((i * 0.91) % (z.poly[2].y - z.poly[1].y));
          ctx.fillRect(x, y, 0.18, 0.18);
        }
      } else if (z.kind === 'slope') {
        poly(z.poly);
        const ax = z.accel.x;
        const ay = z.accel.y;
        const x0 = z.poly[0].x;
        const x1 = z.poly[1].x;
        const g = ctx.createLinearGradient(ax > 0 ? x0 : x1, 0, ax > 0 ? x1 : x0, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = g;
        ctx.fill();
        // setas mostram para onde a rampa empurra a bola
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.35;
        const cx = (x0 + x1) / 2;
        const ys = [z.poly[0].y + 2.5, (z.poly[0].y + z.poly[2].y) / 2, z.poly[2].y - 2.5];
        const d = Math.sign(ax || ay);
        for (const y of ys)
          for (const off of [-1.5, 1.5]) {
            ctx.beginPath();
            ctx.moveTo(cx + off - d * 0.8, y - 1);
            ctx.lineTo(cx + off + d * 0.4, y);
            ctx.lineTo(cx + off - d * 0.8, y + 1);
            ctx.stroke();
          }
      }
    }
    ctx.restore();
    // blocos e paredes internas
    for (const bl of level.blocks) {
      ctx.save();
      ctx.translate(0.35, 0.5);
      poly(bl);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.restore();
      poly(bl);
      ctx.fillStyle = th.block[0];
      ctx.fill();
      ctx.save();
      ctx.translate(0, -0.3);
      poly(bl);
      ctx.fillStyle = th.block[1];
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,30,10,0.6)';
      ctx.lineWidth = px * 1.5;
      ctx.stroke();
      ctx.restore();
    }
    for (const w of level.walls) {
      if (w.r <= 0) continue;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = w.r * 2;
      ctx.beginPath();
      ctx.moveTo(w.a.x + 0.35, w.a.y + 0.5);
      ctx.lineTo(w.b.x + 0.35, w.b.y + 0.5);
      ctx.stroke();
      ctx.strokeStyle = th.wall[1];
      ctx.beginPath();
      ctx.moveTo(w.a.x, w.a.y);
      ctx.lineTo(w.b.x, w.b.y);
      ctx.stroke();
    }
    // pedras (para-choques)
    for (const bm of level.bumpers) {
      const g = ctx.createRadialGradient(bm.c.x - bm.r * 0.3, bm.c.y - bm.r * 0.4, bm.r * 0.1, bm.c.x, bm.c.y, bm.r);
      g.addColorStop(0, '#c9c4bb');
      g.addColorStop(1, '#6f6a62');
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(bm.c.x + 0.3, bm.c.y + 0.45, bm.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bm.c.x, bm.c.y, bm.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // tee
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(level.tee.x - 1.2, level.tee.y - 1.2, 2.4, 2.4);
    // palmeiras na areia/água (decoração determinística)
    const palms = [
      [b.x + 1.5, b.y + 1.5],
      [b.x + b.w - 1.5, b.y + b.h - 1.5],
      [b.x + b.w - 2, b.y + 1.8],
    ];
    for (const [x, y] of palms) this.palm(ctx, x, y);
    return c;
  }

  private palm(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 0.8, y + 1, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      ctx.fillStyle = i % 2 ? this.theme.leaf[0] : this.theme.leaf[1];
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.9, 0.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = this.theme.trunk;
    ctx.beginPath();
    ctx.arc(x, y, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  render(st: GolfRenderState): void {
    const ctx = this.ctx;
    const lv = st.level;
    if (!this.bg || this.bgLevel !== lv.id) {
      this.bg = this.buildBackground(lv);
      this.bgLevel = lv.id;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    this.world(ctx);
    const px = 1 / this.scale;
    const R = GOLF.ballR;

    // buraco + bandeira
    const h = lv.hole;
    ctx.fillStyle = '#0d1a10';
    ctx.beginPath();
    ctx.arc(h.x, h.y, GOLF.holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = px * 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + 3.2, h.y + 1.6);
    ctx.stroke();
    const wave = Math.sin(st.t * 4) * 0.25;
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + 0.6, h.y - 4.2);
    ctx.stroke();
    ctx.fillStyle = '#e8343a';
    ctx.beginPath();
    ctx.moveTo(h.x + 0.6, h.y - 4.2);
    ctx.quadraticCurveTo(h.x + 2, h.y - 4 + wave, h.x + 3.1, h.y - 3.7 + wave);
    ctx.lineTo(h.x + 0.45, h.y - 2.6);
    ctx.closePath();
    ctx.fill();

    // obstáculos móveis
    for (const m of lv.movers) {
      if (m.kind === 'rotor') {
        for (const s of moverSegments(m, st.t)) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = m.r * 2.4;
          ctx.beginPath();
          ctx.moveTo(s.a.x + 0.4, s.a.y + 0.6);
          ctx.lineTo(s.b.x + 0.4, s.b.y + 0.6);
          ctx.stroke();
          ctx.strokeStyle = '#d23f3f';
          ctx.lineWidth = m.r * 2;
          ctx.beginPath();
          ctx.moveTo(s.a.x, s.a.y);
          ctx.lineTo(s.b.x, s.b.y);
          ctx.stroke();
          ctx.strokeStyle = '#f7efe3';
          ctx.lineWidth = m.r * 0.7;
          ctx.stroke();
        }
        ctx.fillStyle = '#5a3418';
        ctx.beginPath();
        ctx.arc(m.center.x, m.center.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c07a42';
        ctx.beginPath();
        ctx.arc(m.center.x, m.center.y - 0.15, 1.05, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const r = sliderRect(m, st.t);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(r.x + 0.35, r.y + 0.5, r.w, r.h);
        ctx.fillStyle = '#6b4ad6';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = '#9c82ff';
        ctx.fillRect(r.x, r.y - 0.25, r.w, r.h * 0.85);
      }
    }

    // linha de mira pontilhada (só até o 1º contato)
    if (st.aim) {
      const { from, to } = st.aim;
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const ux = (to.x - from.x) / (len || 1);
      const uy = (to.y - from.y) / (len || 1);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let d = R * 1.8; d < len; d += 1.1) {
        ctx.beginPath();
        ctx.arc(from.x + ux * d, from.y + uy * d, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (st.aim.hit) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = px * 2;
        ctx.beginPath();
        ctx.arc(to.x, to.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
      // prévia curta da tabela (pontos que somem)
      const af = st.aim.after;
      if (af) {
        const bl = Math.hypot(af.x - to.x, af.y - to.y);
        const bx = (af.x - to.x) / (bl || 1);
        const by = (af.y - to.y) / (bl || 1);
        for (let d = 1.1; d < bl; d += 1.1) {
          ctx.globalAlpha = 0.85 * (1 - d / (bl + 1));
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath();
          ctx.arc(to.x + bx * d, to.y + by * d, 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // rastro (cosmético, shared/fx)
    if (st.trail && st.trail.pts.length > 1) drawTrail(ctx, st.trail.id, st.trail.pts, R, st.trail.color, st.t);

    // bolas: inteiras na cor do jogador, com covinhas que giram
    for (const b of st.balls) {
      if (!b.visible || b.scale <= 0) continue;
      const r = R * b.scale;
      ctx.globalAlpha = b.active || b.dark > 0 ? 1 : 0.92;
      if (b.active) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = px * 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, R * 2.3 + Math.sin(st.t * 4) * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = px * 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(b.x + 0.2 * b.scale, b.y + 0.3 * b.scale, r, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.05, b.x, b.y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, shade(b.color, 0.15));
      g.addColorStop(0.7, b.color);
      g.addColorStop(1, shade(b.color, -0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      // covinhas: pontos fixos na esfera, rodados pela orientação; só os virados para cima aparecem
      const m = qmat(b.q);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (const d of DIMPLES) {
        const zx = m[6] * d[0] + m[7] * d[1] + m[8] * d[2];
        if (zx > -0.15) continue;
        const xx = m[0] * d[0] + m[1] * d[1] + m[2] * d[2];
        const yy = m[3] * d[0] + m[4] * d[1] + m[5] * d[2];
        ctx.beginPath();
        ctx.arc(b.x + xx * r * 0.92, b.y + yy * r * 0.92, r * 0.075 * Math.sqrt(-zx), 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.dark > 0) {
        ctx.fillStyle = `rgba(0,0,0,${b.dark})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const p of st.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    st.fx?.draw(ctx);

    if (st.putter) paintPutter(ctx, st.putter.skin, st.putter.x, st.putter.y, st.putter.angle, st.putter.gap, 1);

    if (st.splash) {
      const k = st.splash.age;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.8 - k)})`;
      ctx.lineWidth = px * 2;
      for (const f of [1, 1.8]) {
        ctx.beginPath();
        ctx.arc(st.splash.x, st.splash.y, (0.6 + k * 3) * f, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

/** Pontos fixos na esfera (distribuição de Fibonacci) para as covinhas. */
const DIMPLES: number[][] = (() => {
  const n = 46;
  const out: number[][] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    out.push([Math.cos(ga * i) * rr, y, Math.sin(ga * i) * rr]);
  }
  return out;
})();

function qmat(q: [number, number, number, number]): number[] {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

/** Escurece (k<0) ou clareia (k>0) uma cor #rrggbb. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
