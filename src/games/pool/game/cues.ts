import { isUnlocked } from '../../../services/economy';

/**
 * Catálogo de tacos (apenas visual — todos têm a MESMA física, para não haver vantagem paga).
 * Premium ficam bloqueados até existir compra de verdade (loja do app); não simulamos pagamento.
 */
export type CueTier = 'free' | 'premium';

export interface CueSegment {
  from: number; // fração do comprimento, 0 = ponta
  to: number;
  colors: string[]; // gradiente ao longo da largura (lado → meio → lado)
}

export interface CueSkin {
  id: string;
  name: string;
  tier: CueTier;
  description: string;
  tip: string;
  segments: CueSegment[];
  /** Losangos decorativos (marchetaria) — posição ao longo do taco e cor. */
  inlays?: { at: number; color: string }[];
  /** Brilho externo (tacos especiais). */
  glow?: string;
}

const wood = (c: string, d: string) => [d, c, d];

export const CUES: CueSkin[] = [
  {
    id: 'classico',
    name: 'Clássico',
    tier: 'free',
    description: 'Maple claro e cabo de madeira escura.',
    tip: '#3a6fb0',
    segments: [
      { from: 0, to: 0.018, colors: ['#e9e4d8', '#ffffff', '#e9e4d8'] },
      { from: 0.018, to: 0.62, colors: wood('#f0d9a8', '#c9a66b') },
      { from: 0.62, to: 0.65, colors: ['#111', '#2a2a2a', '#111'] },
      { from: 0.65, to: 0.97, colors: wood('#7a3a18', '#3b1a0a') },
      { from: 0.97, to: 1, colors: ['#0d0d0d', '#262626', '#0d0d0d'] },
    ],
  },
  {
    id: 'ebano',
    name: 'Ébano',
    tier: 'free',
    description: 'Haste escura e anéis prateados.',
    tip: '#2f5d8f',
    segments: [
      { from: 0, to: 0.018, colors: ['#ddd', '#fff', '#ddd'] },
      { from: 0.018, to: 0.6, colors: wood('#a87b4f', '#6e4a2a') },
      { from: 0.6, to: 0.615, colors: ['#9aa0a6', '#f1f3f4', '#9aa0a6'] },
      { from: 0.615, to: 0.97, colors: wood('#2b2320', '#0f0c0b') },
      { from: 0.97, to: 1, colors: ['#9aa0a6', '#e8eaed', '#9aa0a6'] },
    ],
  },
  {
    id: 'oceano',
    name: 'Oceano',
    tier: 'free',
    description: 'Cabo azul-marinho com detalhes brancos.',
    tip: '#1d4f8b',
    segments: [
      { from: 0, to: 0.018, colors: ['#e9e4d8', '#fff', '#e9e4d8'] },
      { from: 0.018, to: 0.6, colors: wood('#f3e2bd', '#d1b07a') },
      { from: 0.6, to: 0.63, colors: ['#e8e8e8', '#ffffff', '#e8e8e8'] },
      { from: 0.63, to: 0.97, colors: ['#0b2447', '#1f4e8c', '#0b2447'] },
      { from: 0.97, to: 1, colors: ['#e8e8e8', '#fff', '#e8e8e8'] },
    ],
    inlays: [{ at: 0.72, color: '#ffffff' }, { at: 0.8, color: '#ffffff' }, { at: 0.88, color: '#ffffff' }],
  },
  {
    id: 'dragao',
    name: 'Dragão Dourado',
    tier: 'premium',
    description: 'Preto laqueado com marchetaria em ouro.',
    tip: '#1b1b1b',
    segments: [
      { from: 0, to: 0.018, colors: ['#c9a227', '#fff1b8', '#c9a227'] },
      { from: 0.018, to: 0.58, colors: wood('#f4dfb0', '#caa36a') },
      { from: 0.58, to: 0.6, colors: ['#8a6d12', '#ffe28a', '#8a6d12'] },
      { from: 0.6, to: 0.97, colors: ['#050505', '#2a2a2a', '#050505'] },
      { from: 0.97, to: 1, colors: ['#8a6d12', '#ffe28a', '#8a6d12'] },
    ],
    inlays: [0.66, 0.71, 0.76, 0.81, 0.86, 0.91].map((at) => ({ at, color: '#f2c14e' })),
  },
  {
    id: 'neon',
    name: 'Neon',
    tier: 'premium',
    description: 'Fibra de carbono com faixa luminosa.',
    tip: '#00e5ff',
    segments: [
      { from: 0, to: 0.018, colors: ['#00b8d4', '#e0f7fa', '#00b8d4'] },
      { from: 0.018, to: 0.62, colors: ['#1a1a1a', '#3a3a3a', '#1a1a1a'] },
      { from: 0.62, to: 0.66, colors: ['#00b8d4', '#b2ffff', '#00b8d4'] },
      { from: 0.66, to: 0.97, colors: ['#0a0a0a', '#262626', '#0a0a0a'] },
      { from: 0.97, to: 1, colors: ['#00b8d4', '#b2ffff', '#00b8d4'] },
    ],
    glow: 'rgba(0,229,255,0.55)',
  },
  {
    id: 'marmore',
    name: 'Mármore Real',
    tier: 'premium',
    description: 'Cabo de mármore branco com veios e anéis de bronze.',
    tip: '#6d4c41',
    segments: [
      { from: 0, to: 0.018, colors: ['#d7ccc8', '#fff', '#d7ccc8'] },
      { from: 0.018, to: 0.6, colors: wood('#f6e7c8', '#d8b88a') },
      { from: 0.6, to: 0.62, colors: ['#8d5524', '#e0a96d', '#8d5524'] },
      { from: 0.62, to: 0.97, colors: ['#cfd8dc', '#ffffff', '#b0bec5'] },
      { from: 0.97, to: 1, colors: ['#8d5524', '#e0a96d', '#8d5524'] },
    ],
    inlays: [{ at: 0.7, color: '#8d5524' }, { at: 0.79, color: '#37474f' }, { at: 0.88, color: '#8d5524' }],
  },
];

export const DEFAULT_CUE = 'classico';

export function cueById(id: string | undefined): CueSkin {
  return CUES.find((c) => c.id === id) ?? CUES[0];
}

/** Padrão sempre; outros comprados com fichas; premium só com Premium (src/services/catalog.ts). */
export function isCueAvailable(c: CueSkin): boolean {
  return isUnlocked(`pool.cue.${c.id}`);
}

/**
 * Desenha o taco partindo da ponta (tipX, tipY), indo na direção (dx, dy) por `len`.
 * Larguras em unidades do contexto atual.
 */
export function paintCue(
  ctx: CanvasRenderingContext2D,
  skin: CueSkin,
  tipX: number,
  tipY: number,
  dx: number,
  dy: number,
  len: number,
  wTip: number,
  wButt: number,
  px: number,
): void {
  const nx = -dy;
  const ny = dx;
  const width = (t: number) => wTip + (wButt - wTip) * t;
  const P = (t: number, side: number) => [tipX + dx * len * t + nx * width(t) * side, tipY + dy * len * t + ny * width(t) * side];

  if (skin.glow) {
    ctx.save();
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 14;
  }
  for (const s of skin.segments) {
    const a0 = P(s.from, 1);
    const b0 = P(s.to, 1);
    const b1 = P(s.to, -1);
    const a1 = P(s.from, -1);
    const mx = tipX + dx * len * ((s.from + s.to) / 2);
    const my = tipY + dy * len * ((s.from + s.to) / 2);
    const w = width((s.from + s.to) / 2);
    const g = ctx.createLinearGradient(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
    s.colors.forEach((c, i) => g.addColorStop(i / (s.colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.lineTo(b0[0], b0[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.lineTo(a1[0], a1[1]);
    ctx.closePath();
    ctx.fill();
  }
  if (skin.glow) ctx.restore();
  // ponta (sola de couro com giz)
  const t0 = P(0, 1);
  const t1 = P(0, -1);
  ctx.strokeStyle = skin.tip;
  ctx.lineWidth = Math.max(px * 2, len * 0.006);
  ctx.beginPath();
  ctx.moveTo(t0[0], t0[1]);
  ctx.lineTo(t1[0], t1[1]);
  ctx.stroke();
  // marchetaria
  for (const inl of skin.inlays ?? []) {
    const cx = tipX + dx * len * inl.at;
    const cy = tipY + dy * len * inl.at;
    const w = width(inl.at) * 0.7;
    const l = len * 0.018;
    ctx.fillStyle = inl.color;
    ctx.beginPath();
    ctx.moveTo(cx - dx * l, cy - dy * l);
    ctx.lineTo(cx + nx * w, cy + ny * w);
    ctx.lineTo(cx + dx * l, cy + dy * l);
    ctx.lineTo(cx - nx * w, cy - ny * w);
    ctx.closePath();
    ctx.fill();
  }
  // reflexo
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = px;
  const r0 = P(0.02, 0.4);
  const r1 = P(0.98, 0.4);
  ctx.beginPath();
  ctx.moveTo(r0[0], r0[1]);
  ctx.lineTo(r1[0], r1[1]);
  ctx.stroke();
}
