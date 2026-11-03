import { shadeHex, TABLE_THEMES, TableTheme } from './tables';
import type { ObjectPath, RayHit } from '../physics/raycast';
import type { Segment, TableGeometry } from '../physics/table';
import type { Vec } from '../physics/vec';
import type { World } from '../physics/world';
import { BallPainter } from './ballSprite';
import { CueSkin, paintCue } from './cues';
import { drawTrail, FxPoint, ParticleSystem, TrailId } from '../../shared/fx';
import { fxFrame, PocketAnim, RailGeom, slotY } from './pocketFx';

export const BALL_COLORS: Record<number, string> = {
  0: '#f6f1e3',
  1: '#f2b705', 2: '#1d4fb8', 3: '#d42a2a', 4: '#6b2d93', 5: '#f07400', 6: '#14824a', 7: '#7d1f22', 8: '#141414',
  9: '#f2b705', 10: '#1d4fb8', 11: '#d42a2a', 12: '#6b2d93', 13: '#f07400', 14: '#14824a', 15: '#7d1f22',
};

/** Espessura visual das tabelas de madeira (m) além da linha das bocas. */
const RAIL = 0.135;
/** Canaleta de bolas encaçapadas, à direita da mesa. */
const TRAY_GAP = 0.035;
const TRAY_W = 0.09;
const TRAY_EXTRA = TRAY_GAP + TRAY_W + 0.01;
const CUSHION = 0.045;

export interface RenderState {
  /** Rastro da branca (cosmético) e partículas de caçapa. */
  trail?: { id: TrailId; pts: FxPoint[]; color: string } | null;
  particles?: ParticleSystem | null;
  world: World;
  alpha: number;
  aimAngle: number;
  showAim: boolean;
  aimHit: RayHit | null;
  aimLegal: boolean;
  /** Linha guia opcional: para onde vai a bola atingida (até o primeiro contato dela). */
  objectPath?: ObjectPath | null;
  /** 0..1: recuo do taco (anima o golpe). */
  cuePull: number;
  showCue: boolean;
  ballInHand: 'none' | 'kitchen' | 'anywhere';
  cueValid: boolean;
  callMode: boolean;
  calledPocket: number | null;
  time: number;
  /** Animações de bolas caindo/rolando na canaleta e ordem das encaçapadas. */
  pocketAnims: PocketAnim[];
  railOrder: number[];
  fxNow: number;
  cueSkin: CueSkin;
  /** Destaque do taco quando o jogador está segurando/puxando direto na mesa. */
  cueGrabbed: boolean;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  scale = 1;
  ox = 0;
  oy = 0;
  private table: TableGeometry;
  private staticLayer: HTMLCanvasElement | null = null;
  private dpr = 1;
  private balls = new BallPainter();
  private theme: TableTheme = TABLE_THEMES[0];

  /** Troca o tema visual da mesa (refaz a camada estática no próximo quadro). */
  get burstStyle() {
    return this.theme.burst;
  }

  setTheme(t: TableTheme): void {
    if (t.id === this.theme.id) return;
    this.theme = t;
    this.staticLayer = null;
  }

  constructor(private canvas: HTMLCanvasElement, table: TableGeometry) {
    this.ctx = canvas.getContext('2d')!;
    this.table = table;
  }

  /** Ajusta o canvas ao contêiner mantendo a proporção da mesa. */
  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const T = this.table;
    const fullW = T.length + 2 * RAIL + TRAY_EXTRA;
    const fullH = T.width + 2 * RAIL;
    const s = Math.min(cssW / fullW, cssH / fullH);
    const w = Math.floor(fullW * s);
    const h = Math.floor(fullH * s);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.scale = s;
    this.ox = RAIL * s;
    this.oy = RAIL * s;
    this.staticLayer = null;
  }

  /** Converte coordenadas CSS do canvas para o mundo (m). */
  toWorld(px: number, py: number): Vec {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  private applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
  }

  private buildStatic(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    this.applyTransform(ctx);
    const T = this.table;
    const L = T.length;
    const W = T.width;
    const px = 1 / this.scale;

    // Madeira
    const outer = { x: -RAIL, y: -RAIL, w: L + 2 * RAIL, h: W + 2 * RAIL };
    const wood = ctx.createLinearGradient(0, -RAIL, 0, W + RAIL);
    const th = this.theme;
    wood.addColorStop(0, th.wood[0]);
    wood.addColorStop(0.5, th.wood[1]);
    wood.addColorStop(1, th.wood[2]);
    roundRect(ctx, outer.x, outer.y, outer.w, outer.h, 0.09);
    ctx.fillStyle = wood;
    ctx.fill();
    // veios
    ctx.save();
    roundRect(ctx, outer.x, outer.y, outer.w, outer.h, 0.09);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = th.grain;
    ctx.lineWidth = px * 1.2;
    for (let i = 0; i < 60; i++) {
      const y = -RAIL + ((i * 37) % 100) / 100 * (W + 2 * RAIL);
      ctx.beginPath();
      ctx.moveTo(-RAIL, y);
      for (let x = -RAIL; x <= L + RAIL; x += 0.1) ctx.lineTo(x, y + Math.sin(x * 7 + i) * 0.004);
      ctx.stroke();
    }
    ctx.restore();
    // brilho na borda da madeira
    ctx.lineWidth = px * 2;
    ctx.strokeStyle = 'rgba(255,200,150,0.25)';
    roundRect(ctx, outer.x + px, outer.y + px, outer.w - 2 * px, outer.h - 2 * px, 0.088);
    ctx.stroke();

    // Feltro
    const clothPad = CUSHION;
    const cloth = ctx.createRadialGradient(L / 2, W / 2, 0.1, L / 2, W / 2, L * 0.62);
    cloth.addColorStop(0, th.cloth[0]);
    cloth.addColorStop(0.65, th.cloth[1]);
    cloth.addColorStop(1, th.cloth[2]);
    ctx.fillStyle = cloth;
    ctx.fillRect(-clothPad, -clothPad, L + 2 * clothPad, W + 2 * clothPad);

    // Caçapas (buracos)
    for (const pk of T.pockets) {
      // o buraco desenhado é exatamente a área de queda da física (+ 3 mm de borda escura)
      const r = pk.captureRadius + 0.003;
      const g = ctx.createRadialGradient(pk.center.x, pk.center.y, r * 0.2, pk.center.x, pk.center.y, r);
      g.addColorStop(0, '#000');
      g.addColorStop(0.75, '#070707');
      g.addColorStop(1, '#1b1b1b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pk.center.x, pk.center.y, r, 0, Math.PI * 2);
      ctx.fill();
      // garganta: preenche o canal entre as quinas
      ctx.beginPath();
      const a = pk.mouthA;
      const b = pk.mouthB;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + pk.axis.x * 0.07, a.y + pk.axis.y * 0.07);
      ctx.lineTo(b.x + pk.axis.x * 0.07, b.y + pk.axis.y * 0.07);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      const tg = ctx.createLinearGradient(
        (a.x + b.x) / 2, (a.y + b.y) / 2,
        (a.x + b.x) / 2 + pk.axis.x * 0.07, (a.y + b.y) / 2 + pk.axis.y * 0.07,
      );
      tg.addColorStop(0, shadeHex(th.cloth[2], -0.35));
      tg.addColorStop(1, '#050505');
      ctx.fillStyle = tg;
      ctx.fill();
    }

    // Borrachas das tabelas: trapézios cujas pontas seguem as gargantas (mesma geometria da física)
    const jaws = T.segments.filter((s) => s.kind === 'jaw');
    const jawDirAt = (p: Vec): Vec | null => {
      const j = jaws.find((s) => Math.abs(s.a.x - p.x) < 1e-9 && Math.abs(s.a.y - p.y) < 1e-9);
      if (!j) return null;
      const dx = j.b.x - j.a.x;
      const dy = j.b.y - j.a.y;
      const l = Math.hypot(dx, dy);
      return { x: dx / l, y: dy / l };
    };
    for (const s of T.segments.filter((x) => x.kind === 'cushion')) {
      drawCushion(ctx, s, jawDirAt(s.a), jawDirAt(s.b), L, W, th);
    }

    // Tampas metálicas nos cantos e laterais
    for (const pk of T.pockets) {
      const r = pk.kind === 'corner' ? 0.1 : 0.07;
      const cx = pk.center.x + pk.axis.x * (pk.kind === 'corner' ? 0.012 : -0.01);
      const cy = pk.center.y + pk.axis.y * (pk.kind === 'corner' ? 0.012 : -0.01);
      const start = Math.atan2(pk.axis.y, pk.axis.x) - (pk.kind === 'corner' ? 1.25 : 1.05);
      const end = start + (pk.kind === 'corner' ? 2.5 : 2.1);
      const mg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      mg.addColorStop(0, th.metal[0]);
      mg.addColorStop(0.5, th.metal[1]);
      mg.addColorStop(1, th.metal[2]);
      ctx.strokeStyle = mg;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
    }

    // Diamantes
    ctx.fillStyle = th.diamond;
    const dmy = [-CUSHION - (RAIL - CUSHION) / 2, W + CUSHION + (RAIL - CUSHION) / 2];
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      for (const y of dmy) diamond(ctx, (L / 8) * i, y, 0.011);
    }
    const dmx = [-CUSHION - (RAIL - CUSHION) / 2, L + CUSHION + (RAIL - CUSHION) / 2];
    for (let i = 1; i < 4; i++) for (const x of dmx) diamond(ctx, x, (W / 4) * i, 0.011);

    // Linha de cabeceira e ponto do pé (marcas discretas)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(T.headStringX, 0);
    ctx.lineTo(T.headStringX, W);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (const p of [T.footSpot, T.headSpot]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
    // Canaleta (vidro escuro numa moldura de madeira)
    const g = this.rail();
    const x0 = g.x - TRAY_W / 2;
    const y0 = -RAIL;
    const h = W + 2 * RAIL;
    roundRect(ctx, x0, y0, TRAY_W, h, TRAY_W / 2);
    ctx.fillStyle = wood;
    ctx.fill();
    const inset = 0.012;
    roundRect(ctx, x0 + inset, y0 + inset, TRAY_W - 2 * inset, h - 2 * inset, TRAY_W / 2 - inset);
    const tube = ctx.createLinearGradient(x0, 0, x0 + TRAY_W, 0);
    tube.addColorStop(0, '#050403');
    tube.addColorStop(0.5, '#1d1612');
    tube.addColorStop(1, '#050403');
    ctx.fillStyle = tube;
    ctx.fill();
    // boca de entrada no alto
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(g.x, g.topY + 0.012, TRAY_W / 2 - inset * 1.4, 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  /** Geometria da canaleta em coordenadas do mundo. */
  rail(): RailGeom {
    const T = this.table;
    return { x: T.length + RAIL + TRAY_GAP + TRAY_W / 2, topY: -RAIL + 0.03, bottomY: T.width + RAIL - 0.016, R: 0.028575 };
  }

  render(st: RenderState): void {
    const ctx = this.ctx;
    if (!this.staticLayer) this.staticLayer = this.buildStatic();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.staticLayer, 0, 0);
    this.applyTransform(ctx);
    const px = 1 / this.scale;
    const w = st.world;
    const R = w.params.ballRadius;
    const T = this.table;

    // Área da cozinha durante bola na mão de abertura
    if (st.ballInHand === 'kitchen') {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, T.headStringX, T.width);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([0.02, 0.015]);
      ctx.lineWidth = px * 1.5;
      ctx.beginPath();
      ctx.moveTo(T.headStringX, 0);
      ctx.lineTo(T.headStringX, T.width);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Caçapas para cantar a 8
    if (st.callMode) {
      const pulse = 0.5 + 0.5 * Math.sin(st.time * 5);
      for (const pk of T.pockets) {
        const sel = st.calledPocket === pk.id;
        ctx.strokeStyle = sel ? '#ffd54a' : `rgba(255,213,74,${0.25 + 0.35 * pulse})`;
        ctx.lineWidth = sel ? 0.012 : 0.006;
        ctx.beginPath();
        ctx.arc(pk.center.x, pk.center.y, 0.075, 0, Math.PI * 2);
        ctx.stroke();
        if (sel) {
          ctx.fillStyle = 'rgba(255,213,74,0.25)';
          ctx.fill();
        }
      }
    }

    // Sombras
    ctx.fillStyle = 'rgba(0,0,0,0.33)';
    for (const b of w.balls) {
      if (b.pocketed) continue;
      const x = b.px + (b.x - b.px) * st.alpha;
      const y = b.py + (b.y - b.py) * st.alpha;
      ctx.beginPath();
      ctx.ellipse(x + R * 0.18, y + R * 0.28, R * 1.02, R * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rastro da branca (por baixo das bolas)
    if (st.trail) drawTrail(ctx, st.trail.id, st.trail.pts, R, st.trail.color, st.time);

    const cue = w.balls.find((b) => b.id === 0)!;
    const cx = cue.px + (cue.x - cue.px) * st.alpha;
    const cy = cue.py + (cue.y - cue.py) * st.alpha;

    // Guia de mira: um único segmento reto até o primeiro contato
    if (st.showAim && st.aimHit && !cue.pocketed) {
      const h = st.aimHit;
      const col = st.aimLegal ? 'rgba(255,255,255,0.9)' : 'rgba(255,110,110,0.9)';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(px * 1.6, 0.0035);
      const sx = cx + Math.cos(st.aimAngle) * R;
      const sy = cy + Math.sin(st.aimAngle) * R;
      const endT = Math.max(0, h.t - R);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx + Math.cos(st.aimAngle) * (R + endT), cy + Math.sin(st.aimAngle) * (R + endT));
      ctx.stroke();
      // bola fantasma (posição do centro da branca no impacto)
      ctx.lineWidth = Math.max(px * 1.4, 0.003);
      ctx.beginPath();
      ctx.arc(h.ghost.x, h.ghost.y, R, 0, Math.PI * 2);
      ctx.stroke();
      if (h.kind === 'ball') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(h.contact.x, h.contact.y, Math.max(px * 2.2, 0.004), 0, Math.PI * 2);
        ctx.fill();
      }
      const op = st.objectPath;
      if (op && st.aimLegal && op.hit.t > R) {
        // linha guia: saída da bola atingida até o primeiro contato dela (tracejada para não confundir com a mira)
        ctx.strokeStyle = 'rgba(255,224,130,0.9)';
        ctx.lineWidth = Math.max(px * 1.6, 0.0035);
        ctx.setLineDash([R * 0.9, R * 0.6]);
        ctx.beginPath();
        ctx.moveTo(op.from.x + op.dir.x * R, op.from.y + op.dir.y * R);
        ctx.lineTo(op.hit.ghost.x, op.hit.ghost.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(px * 1.2, 0.0025);
        ctx.beginPath();
        ctx.arc(op.hit.ghost.x, op.hit.ghost.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Bolas
    for (const b of w.balls) {
      if (b.pocketed) continue;
      const x = b.px + (b.x - b.px) * st.alpha;
      const y = b.py + (b.y - b.py) * st.alpha;
      this.balls.draw(ctx, b, x, y, R, this.scale * this.dpr, px);
    }

    // Bolas encaçapadas: queda na boca e descida na canaleta
    const rail = this.rail();
    const animById = new Map(st.pocketAnims.map((a) => [a.id, a]));
    ctx.save();
    roundRect(ctx, rail.x - TRAY_W / 2 + 0.012, -RAIL + 0.012, TRAY_W - 0.024, T.width + 2 * RAIL - 0.024, TRAY_W / 2 - 0.012);
    ctx.clip();
    st.railOrder.forEach((id, slot) => {
      const a = animById.get(id);
      const f = a ? fxFrame({ ...a, slot }, st.fxNow, rail) : null;
      if (f && f.stage !== 'rail' && f.stage !== 'done') return;
      const y = f ? f.y : slotY(rail, slot);
      const q = f ? f.q : ([1, 0, 0, 0] as [number, number, number, number]);
      this.balls.draw(ctx, { id, q }, rail.x, y, R, this.scale * this.dpr, px);
    });
    ctx.restore();
    for (const a of st.pocketAnims) {
      const f = fxFrame(a, st.fxNow, rail);
      if (f.stage !== 'drop') continue;
      const r = R * f.scale;
      this.balls.draw(ctx, { id: a.id, q: f.q }, f.x, f.y, r, this.scale * this.dpr, px);
      ctx.fillStyle = `rgba(0,0,0,${f.dark})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Explosão das caçapas (tema da mesa)
    st.particles?.draw(ctx);

    // Bola errada (acertá-la primeiro seria falta): um X vermelho sobre ela
    if (st.showAim && st.aimHit && st.aimHit.kind === 'ball' && !st.aimLegal && !cue.pocketed) {
      const tb = w.balls.find((b) => b.id === st.aimHit!.ballId)!;
      const k = R * 0.95;
      ctx.lineCap = 'round';
      for (const [lw, col] of [[Math.max(px * 5, 0.009), 'rgba(0,0,0,0.55)'], [Math.max(px * 2.8, 0.005), '#ff4d4d']] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(tb.x - k, tb.y - k);
        ctx.lineTo(tb.x + k, tb.y + k);
        ctx.moveTo(tb.x + k, tb.y - k);
        ctx.lineTo(tb.x - k, tb.y + k);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // Bola na mão
    if (st.ballInHand !== 'none' && !cue.pocketed && st.showCue) {
      ctx.strokeStyle = st.cueValid ? 'rgba(255,255,255,0.75)' : 'rgba(255,80,80,0.9)';
      ctx.setLineDash([0.012, 0.009]);
      ctx.lineWidth = px * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.3, st.time * 0.8, st.time * 0.8 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Taco
    if (st.showCue && !cue.pocketed) {
      if (st.cueGrabbed) {
        ctx.save();
        ctx.shadowColor = 'rgba(242,193,78,0.9)';
        ctx.shadowBlur = 14;
      }
      drawCue(ctx, st.cueSkin, cx, cy, st.aimAngle, R + 0.008 + st.cuePull * 0.24, px);
      if (st.cueGrabbed) ctx.restore();
    }
  }
}

function drawCushion(ctx: CanvasRenderingContext2D, s: Segment, ja: Vec | null, jb: Vec | null, L: number, W: number, th: TableTheme) {
  // normal para fora da mesa
  const mx = (s.a.x + s.b.x) / 2;
  const my = (s.a.y + s.b.y) / 2;
  let nx = -(s.b.y - s.a.y);
  let ny = s.b.x - s.a.x;
  const l = Math.hypot(nx, ny);
  nx /= l;
  ny /= l;
  if ((L / 2 - mx) * nx + (W / 2 - my) * ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const endPt = (p: Vec, j: Vec | null): Vec => {
    if (!j) return { x: p.x + nx * CUSHION, y: p.y + ny * CUSHION };
    const k = CUSHION / Math.max(0.2, j.x * nx + j.y * ny);
    return { x: p.x + j.x * k, y: p.y + j.y * k };
  };
  const a2 = endPt(s.a, ja);
  const b2 = endPt(s.b, jb);
  ctx.beginPath();
  ctx.moveTo(s.a.x, s.a.y);
  ctx.lineTo(s.b.x, s.b.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.lineTo(a2.x, a2.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(s.a.x, s.a.y, s.a.x + nx * CUSHION, s.a.y + ny * CUSHION);
  g.addColorStop(0, shadeHex(th.cloth[1], -0.12));
  g.addColorStop(0.35, th.cloth[1]);
  g.addColorStop(1, shadeHex(th.cloth[2], -0.1));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.002;
  ctx.beginPath();
  ctx.moveTo(s.a.x, s.a.y);
  ctx.lineTo(s.b.x, s.b.y);
  ctx.stroke();
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCue(ctx: CanvasRenderingContext2D, skin: CueSkin, cx: number, cy: number, ang: number, gap: number, px: number) {
  const len = 1.45;
  const dx = -Math.cos(ang);
  const dy = -Math.sin(ang);
  const tipX = cx + dx * gap;
  const tipY = cy + dy * gap;
  // sombra no feltro
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  const nx = -dy;
  const ny = dx;
  ctx.moveTo(tipX + nx * 0.0065 + 0.012, tipY + ny * 0.0065 + 0.02);
  ctx.lineTo(tipX + dx * len + nx * 0.0145 + 0.012, tipY + dy * len + ny * 0.0145 + 0.02);
  ctx.lineTo(tipX + dx * len - nx * 0.0145 + 0.012, tipY + dy * len - ny * 0.0145 + 0.02);
  ctx.lineTo(tipX - nx * 0.0065 + 0.012, tipY - ny * 0.0065 + 0.02);
  ctx.fill();
  ctx.restore();
  paintCue(ctx, skin, tipX, tipY, dx, dy, len, 0.0065, 0.0145, px);
}
