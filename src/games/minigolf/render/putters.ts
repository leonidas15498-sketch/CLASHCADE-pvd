import { isUnlocked } from '../../../services/economy';

/** Tacos de minigolfe (só visual — todos jogam igual). Premium ficam bloqueados até existir loja no app. */
export interface PutterSkin {
  id: string;
  name: string;
  tier: 'free' | 'premium';
  description: string;
  shaft: string[];
  head: string[];
  grip: string;
  glow?: string;
}

export const PUTTERS: PutterSkin[] = [
  { id: 'classico', name: 'Clássico', tier: 'free', description: 'Haste de aço e cabeça prateada.', shaft: ['#9aa3ab', '#e6ebef', '#8a939b'], head: ['#7d868e', '#d9dfe4', '#6d757c'], grip: '#222' },
  { id: 'madeira', name: 'Madeira', tier: 'free', description: 'Cabeça de madeira escura e punho de couro.', shaft: ['#8a5a2b', '#c58a4f', '#7a4b20'], head: ['#4a2a12', '#8a5a2b', '#3a200c'], grip: '#5a3418' },
  { id: 'coral', name: 'Coral', tier: 'free', description: 'Cabeça laranja, a cor da ilha.', shaft: ['#9aa3ab', '#e6ebef', '#8a939b'], head: ['#c2412a', '#ff8a6a', '#a8331f'], grip: '#1d1d1d' },
  { id: 'ouro', name: 'Ouro', tier: 'premium', description: 'Cabeça dourada polida.', shaft: ['#8a6d12', '#ffe28a', '#8a6d12'], head: ['#a07c12', '#ffe9a6', '#8a6a0c'], grip: '#111' },
  { id: 'neon', name: 'Neon', tier: 'premium', description: 'Fibra de carbono com brilho azul.', shaft: ['#111', '#3a3a3a', '#111'], head: ['#00a8c2', '#9ff6ff', '#007f94'], grip: '#00e5ff', glow: 'rgba(0,229,255,0.7)' },
  { id: 'oceanico', name: 'Oceânico', tier: 'premium', description: 'Azul do mar com brilho de água.', shaft: ['#09516c', '#75e8ed', '#043c61'], head: ['#07536e', '#00dded', '#03526e'], grip: '#68f7ff', glow: 'rgba(70,220,255,0.45)' },
  { id: 'galaxia', name: 'Galáxia', tier: 'premium', description: 'Violeta cósmico com brilho estelar.', shaft: ['#25113f', '#ca86ff', '#3b175d'], head: ['#4d168b', '#dfadff', '#321054'], grip: '#9f55ff', glow: 'rgba(180,94,255,0.55)' },
  { id: 'halloween', name: 'Halloween', tier: 'premium', description: 'Obsidiana roxa com detalhes âmbar.', shaft: ['#190d23', '#a35ac7', '#170d27'], head: ['#3a125c', '#ff9b3c', '#2a0d44'], grip: '#ff8a1f', glow: 'rgba(255,140,40,0.5)' },
  { id: 'ouro-negro', name: 'Ouro Negro', tier: 'premium', description: 'Preto fosco com filetes dourados.', shaft: ['#0b0b0d', '#3a3a40', '#0b0b0d'], head: ['#111114', '#e8bc53', '#0d0d10'], grip: '#e8bc53' },
  { id: 'selva', name: 'Selva', tier: 'premium', description: 'Verde-folha com punho de couro.', shaft: ['#1e4d22', '#89c965', '#183d1b'], head: ['#245e2a', '#9fe07a', '#1a4720'], grip: '#53451f' },
  { id: 'campeonato', name: 'Campeonato', tier: 'premium', description: 'Azul de torneio com aço escovado.', shaft: ['#9aa3ab', '#f4f7f9', '#8a939b'], head: ['#0e3f6e', '#f4c06d', '#0b3157'], grip: '#0e3f6e' },
];

/** Taco montado pelo jogador (gratuito): cor da cabeça, acabamento da haste e cor do punho. */
export interface PutterCustom {
  head: string;
  shaft: string;
  grip: string;
}
export const CUSTOM_HEADS = ['#d9dfe4', '#ff6b4a', '#3d8bff', '#ffc93c', '#7bd389', '#b76bff', '#ff5fa2', '#2b2b30'];
export const CUSTOM_SHAFTS: { id: string; name: string; cols: string[] }[] = [
  { id: 'aco', name: 'Aço', cols: ['#9aa3ab', '#e6ebef', '#8a939b'] },
  { id: 'carbono', name: 'Carbono', cols: ['#111', '#3a3a3a', '#111'] },
  { id: 'ouro', name: 'Ouro', cols: ['#8a6d12', '#ffe28a', '#8a6d12'] },
  { id: 'madeira', name: 'Madeira', cols: ['#8a5a2b', '#c58a4f', '#7a4b20'] },
];
export const CUSTOM_GRIPS = ['#1d1d1d', '#5a3418', '#ff6b4a', '#3d8bff', '#ffc93c', '#f4f4f4'];
export const DEFAULT_CUSTOM: PutterCustom = { head: '#ff6b4a', shaft: 'aco', grip: '#1d1d1d' };

export function isValidCustom(c: unknown): c is PutterCustom {
  const x = c as PutterCustom;
  return !!x && CUSTOM_HEADS.includes(x.head) && CUSTOM_SHAFTS.some((s) => s.id === x.shaft) && CUSTOM_GRIPS.includes(x.grip);
}

export function customPutter(c: PutterCustom): PutterSkin {
  const shaft = CUSTOM_SHAFTS.find((s) => s.id === c.shaft) ?? CUSTOM_SHAFTS[0];
  return {
    id: 'custom',
    name: 'Personalizado',
    tier: 'free',
    description: 'Monte o seu: cabeça, haste e punho.',
    shaft: shaft.cols,
    head: [shade(c.head, -0.35), shade(c.head, 0.35), shade(c.head, -0.45)],
    grip: c.grip,
  };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export const putterById = (id: string | undefined) => PUTTERS.find((p) => p.id === id) ?? PUTTERS[0];
export const isPutterAvailable = (p: PutterSkin) => isUnlocked(`golf.putter.${p.id}`);

const grad = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, cols: string[]) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
};

/**
 * Desenha o taco atrás da bola: a cabeça fica a `gap` do centro da bola, alinhada à mira, e a haste
 * sai para trás. Coordenadas no espaço atual do contexto.
 */
export function paintPutter(ctx: CanvasRenderingContext2D, skin: PutterSkin, bx: number, by: number, ang: number, gap: number, unit: number) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const hx = bx - dx * gap; // centro da face da cabeça
  const hy = by - dy * gap;
  const headW = 0.9 * unit; // profundidade
  const headL = 2.6 * unit; // largura (perpendicular à mira)
  const shaftLen = 9 * unit;
  const sw = 0.28 * unit;
  if (skin.glow) {
    ctx.save();
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 12;
  }
  // sombra
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.translate(0.4 * unit, 0.6 * unit);
  quad(ctx, hx, hy, dx, dy, nx, ny, headW, headL);
  ctx.fill();
  ctx.restore();
  // haste: sai do meio de trás da cabeça, inclinada para o lado
  const sx = hx - dx * headW;
  const sy = hy - dy * headW;
  const ex = sx - dx * shaftLen * 0.92 + nx * shaftLen * 0.35;
  const ey = sy - dy * shaftLen * 0.92 + ny * shaftLen * 0.35;
  ctx.lineCap = 'round';
  ctx.strokeStyle = grad(ctx, sx + nx * sw, sy + ny * sw, sx - nx * sw, sy - ny * sw, skin.shaft);
  ctx.lineWidth = sw * 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // punho
  ctx.strokeStyle = skin.grip;
  ctx.lineWidth = sw * 2.6;
  ctx.beginPath();
  ctx.moveTo(sx + (ex - sx) * 0.7, sy + (ey - sy) * 0.7);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // cabeça
  quad(ctx, hx, hy, dx, dy, nx, ny, headW, headL);
  ctx.fillStyle = grad(ctx, hx + nx * headL / 2, hy + ny * headL / 2, hx - nx * headL / 2, hy - ny * headL / 2, skin.head);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = unit * 0.08;
  ctx.stroke();
  if (skin.glow) ctx.restore();
}

function quad(ctx: CanvasRenderingContext2D, hx: number, hy: number, dx: number, dy: number, nx: number, ny: number, w: number, l: number) {
  ctx.beginPath();
  ctx.moveTo(hx + nx * l / 2, hy + ny * l / 2);
  ctx.lineTo(hx - nx * l / 2, hy - ny * l / 2);
  ctx.lineTo(hx - nx * l / 2 - dx * w, hy - ny * l / 2 - dy * w);
  ctx.lineTo(hx + nx * l / 2 - dx * w, hy + ny * l / 2 - dy * w);
  ctx.closePath();
}

/** Taco em pé (para a barra lateral): cabeça em cima, haste para baixo, ocupando `len`. */
export function paintPutterVertical(ctx: CanvasRenderingContext2D, skin: PutterSkin, cx: number, top: number, len: number, unit: number) {
  const headH = 0.9 * unit;
  const headW = 2.8 * unit;
  const sw = 0.32 * unit;
  if (skin.glow) {
    ctx.save();
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 10;
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = grad(ctx, cx - sw, 0, cx + sw, 0, skin.shaft);
  ctx.lineWidth = sw * 2;
  ctx.beginPath();
  ctx.moveTo(cx, top + headH);
  ctx.lineTo(cx, top + len);
  ctx.stroke();
  ctx.strokeStyle = skin.grip;
  ctx.lineWidth = sw * 2.7;
  ctx.beginPath();
  ctx.moveTo(cx, top + len * 0.62);
  ctx.lineTo(cx, top + len);
  ctx.stroke();
  ctx.fillStyle = grad(ctx, cx - headW / 2, 0, cx + headW / 2, 0, skin.head);
  ctx.fillRect(cx - headW / 2, top, headW, headH);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - headW / 2, top, headW, headH);
  if (skin.glow) ctx.restore();
}
