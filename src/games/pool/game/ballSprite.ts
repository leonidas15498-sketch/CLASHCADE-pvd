import type { Ball } from '../physics/world';

/**
 * Desenha cada bola como uma esfera de verdade, pixel a pixel, usando a orientação
 * (quatérnio) que a física integra. Assim o número, a faixa das listradas e as
 * bolinhas vermelhas da branca giram conforme a bola rola ou recebe efeito.
 * Só desenho: não altera nenhum estado físico.
 */

const COLORS: Record<number, [number, number, number]> = {
  0: [246, 241, 227],
  1: [242, 183, 5], 2: [29, 79, 184], 3: [212, 42, 42], 4: [107, 45, 147], 5: [240, 116, 0], 6: [20, 130, 74], 7: [125, 31, 34], 8: [20, 20, 20],
  9: [242, 183, 5], 10: [29, 79, 184], 11: [212, 42, 42], 12: [107, 45, 147], 13: [240, 116, 0], 14: [20, 130, 74], 15: [125, 31, 34],
};
const WHITE: [number, number, number] = [246, 241, 227];
const RED: [number, number, number] = [200, 30, 30];

// Eixos fixos no corpo da bola. Em repouso inicial: número virado para cima (−z, para o observador),
// faixa das listradas na horizontal da tela e texto em pé.
const N0 = [0, 0, -1]; // polo do número (o outro número fica no polo oposto)
const S0 = [0, 1, 0]; // eixo da faixa das listradas
const T0 = [0, -1, 0]; // "para cima" do texto
const R0 = [1, 0, 0]; // "para a direita" do texto

const COS_DISC = Math.cos(0.62); // raio angular do círculo branco do número
const COS_DOT = Math.cos(0.2); // raio angular das marcas da branca
const STRIPE_HALF = 0.5; // meia-largura da faixa (|p·s| < 0.5)

// luz vinda de cima-esquerda, do lado do observador
const L = norm3([-0.45, -0.55, -0.7]);
const H = norm3([L[0], L[1], L[2] - 1]);

function norm3(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Matriz de rotação (corpo → mundo) a partir do quatérnio. */
function matrix(q: [number, number, number, number]): number[] {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
const mul = (m: number[], v: number[]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

interface Cache {
  canvas: HTMLCanvasElement;
  img: ImageData;
  size: number;
  key: string;
}

export class BallPainter {
  private cache = new Map<number, Cache>();

  private sprite(id: number, q: [number, number, number, number], size: number): HTMLCanvasElement {
    let c = this.cache.get(id);
    if (!c || c.size !== size) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const img = canvas.getContext('2d')!.createImageData(size, size);
      c = { canvas, img, size, key: '' };
      this.cache.set(id, c);
    }
    const key = q.map((v) => v.toFixed(4)).join(',');
    if (c.key === key) return c.canvas;
    c.key = key;

    const m = matrix(q);
    const data = c.img.data;
    const rpx = size / 2 - 1; // raio em pixels (1 px de margem para o antisserrilhado)
    const half = size / 2;
    const base = COLORS[id];
    const stripe = id >= 9;
    const cue = id === 0;
    for (let j = 0; j < size; j++) {
      const v = (j + 0.5 - half) / rpx;
      for (let i = 0; i < size; i++) {
        const u = (i + 0.5 - half) / rpx;
        const r2 = u * u + v * v;
        const o = (j * size + i) * 4;
        if (r2 > 1.0 + 2 / rpx) {
          data[o + 3] = 0;
          continue;
        }
        const z = -Math.sqrt(Math.max(0, 1 - r2));
        // ponto no corpo da bola: Mᵀ·p
        const bx = m[0] * u + m[3] * v + m[6] * z;
        const by = m[1] * u + m[4] * v + m[7] * z;
        const bz = m[2] * u + m[5] * v + m[8] * z;
        const pn = bx * N0[0] + by * N0[1] + bz * N0[2];
        let col: [number, number, number];
        if (cue) col = Math.abs(pn) > COS_DOT ? RED : WHITE;
        else if (Math.abs(pn) > COS_DISC) col = WHITE;
        else if (stripe) col = Math.abs(bx * S0[0] + by * S0[1] + bz * S0[2]) < STRIPE_HALF ? base : WHITE;
        else col = base;
        // luz: ambiente + difusa + brilho especular
        const nd = Math.max(0, u * L[0] + v * L[1] + z * L[2]);
        const sp = Math.pow(Math.max(0, u * H[0] + v * H[1] + z * H[2]), 60);
        const shade = 0.42 + 0.62 * nd;
        const rim = 1 - 0.25 * Math.pow(r2, 3);
        data[o] = Math.min(255, col[0] * shade * rim + 255 * sp * 0.85);
        data[o + 1] = Math.min(255, col[1] * shade * rim + 255 * sp * 0.85);
        data[o + 2] = Math.min(255, col[2] * shade * rim + 255 * sp * 0.85);
        const edge = (1 - Math.sqrt(r2)) * rpx + 0.5;
        data[o + 3] = Math.max(0, Math.min(1, edge)) * 255;
      }
    }
    c.canvas.getContext('2d')!.putImageData(c.img, 0, 0);
    return c.canvas;
  }

  /**
   * Desenha a bola em (x, y) no contexto já transformado para o mundo.
   * devPerWorld = pixels de dispositivo por metro.
   */
  draw(ctx: CanvasRenderingContext2D, b: Pick<Ball, 'id' | 'q'>, x: number, y: number, R: number, devPerWorld: number, px: number): void {
    const size = Math.max(8, Math.ceil(2 * R * devPerWorld) + 2);
    const spr = this.sprite(b.id, b.q, size);
    if (R <= 0) return;
    const drawn = (size * R) / (size / 2 - 1); // o raio da esfera no sprite é size/2 − 1 px
    ctx.drawImage(spr, x - drawn / 2, y - drawn / 2, drawn, drawn);

    if (b.id !== 0) {
      // números (dois, em polos opostos) com perspectiva correta
      const m = matrix(b.q);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.clip();
      for (const sgn of [1, -1]) {
        const n = mul(m, N0).map((c) => c * sgn);
        if (n[2] > -0.12) continue; // virado para baixo
        const r = mul(m, R0).map((c) => c * sgn);
        const t = mul(m, T0);
        const k = R / 20;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (-n[2] - 0.12) / 0.3);
        ctx.transform(r[0] * k, r[1] * k, -t[0] * k, -t[1] * k, x + n[0] * R, y + n[1] * R);
        ctx.fillStyle = '#111';
        ctx.font = `800 ${b.id >= 10 ? 15 : 18}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.id), 0, 1);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = px * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Ícone da bola (frente, parada) como imagem, para o placar em HTML. */
const iconCache = new Map<string, string>();
const iconPainter = new BallPainter();
export function ballIcon(id: number, cssSize = 22): string {
  const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  const key = `${id}@${cssSize * dpr}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const S = cssSize * dpr;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const k = S / 2.12; // pixels por raio
  ctx.setTransform(k, 0, 0, k, S / 2, S / 2);
  iconPainter.draw(ctx, { id, q: [1, 0, 0, 0] }, 0, 0, 1, k, 1 / k);
  const url = c.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
