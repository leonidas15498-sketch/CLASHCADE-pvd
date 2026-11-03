import { World } from './world';
import { Vec } from './vec';

export interface RayHit {
  /** Distância percorrida pelo centro da branca até o primeiro contato. */
  t: number;
  kind: 'ball' | 'cushion' | 'pocket' | 'none';
  ballId?: number;
  /** Posição do centro da branca no instante do contato ("bola fantasma"). */
  ghost: Vec;
  /** Ponto de contato na superfície (bola-bola ou bola-tabela). */
  contact: Vec;
}

/** Menor t > eps para |o + t·d − c| = r (d unitário). */
function rayCircle(o: Vec, d: Vec, c: Vec, r: number): number {
  const fx = o.x - c.x;
  const fy = o.y - c.y;
  const b = fx * d.x + fy * d.y;
  const cc = fx * fx + fy * fy - r * r;
  if (cc < 0) return b < 0 ? 0 : Infinity; // já dentro: só conta se avançando para dentro
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}

/** Raio contra cápsula (segmento expandido por r): lados retos + extremidades circulares. */
function rayCapsule(o: Vec, d: Vec, a: Vec, b: Vec, r: number): number {
  let best = Infinity;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const L = Math.hypot(ex, ey);
  if (L > 0) {
    const ux = ex / L;
    const uy = ey / L;
    // normal do segmento voltada para a origem do raio
    let nx = -uy;
    let ny = ux;
    const side = (o.x - a.x) * nx + (o.y - a.y) * ny;
    if (side < 0) {
      nx = -nx;
      ny = -ny;
    }
    const dn = d.x * nx + d.y * ny;
    const dist0 = Math.abs(side);
    if (dn < 0 && dist0 >= r) {
      const t = (dist0 - r) / -dn;
      const px = o.x + d.x * t - a.x;
      const py = o.y + d.y * t - a.y;
      const along = px * ux + py * uy;
      if (along >= 0 && along <= L) best = t;
    }
  }
  best = Math.min(best, rayCircle(o, d, a, r), rayCircle(o, d, b, r));
  return best;
}

/**
 * Raycast da guia de mira: trajeto reto da branca até o PRIMEIRO contato
 * (bola, tabela/quina, ou entrada direta em caçapa). Usa exatamente a mesma
 * geometria do motor: bolas como círculos de raio 2R e tabelas como cápsulas de raio R.
 * Não prevê nada após o primeiro contato.
 */
export function aimRaycast(w: World, angle: number): RayHit {
  const cue = w.balls.find((b) => b.id === 0)!;
  const R = w.params.ballRadius;
  const o = { x: cue.x, y: cue.y };
  const d = { x: Math.cos(angle), y: Math.sin(angle) };
  let best: RayHit = { t: Infinity, kind: 'none', ghost: o, contact: o };

  for (const b of w.balls) {
    if (b.id === 0 || b.pocketed) continue;
    const t = rayCircle(o, d, b, 2 * R);
    if (t < best.t) {
      const g = { x: o.x + d.x * t, y: o.y + d.y * t };
      best = { t, kind: 'ball', ballId: b.id, ghost: g, contact: { x: (g.x + b.x) / 2, y: (g.y + b.y) / 2 } };
    }
  }
  for (const s of w.table.segments) {
    const t = rayCapsule(o, d, s.a, s.b, R);
    if (t < best.t) {
      const g = { x: o.x + d.x * t, y: o.y + d.y * t };
      // ponto de contato = ponto do segmento mais próximo da bola fantasma
      const ex = s.b.x - s.a.x;
      const ey = s.b.y - s.a.y;
      const l2 = ex * ex + ey * ey;
      let k = l2 ? ((g.x - s.a.x) * ex + (g.y - s.a.y) * ey) / l2 : 0;
      k = Math.max(0, Math.min(1, k));
      best = { t, kind: 'cushion', ghost: g, contact: { x: s.a.x + ex * k, y: s.a.y + ey * k } };
    }
  }
  for (const pk of w.table.pockets) {
    const t = rayCircle(o, d, pk.center, pk.captureRadius);
    if (t < best.t) {
      const g = { x: o.x + d.x * t, y: o.y + d.y * t };
      best = { t, kind: 'pocket', ghost: g, contact: g };
    }
  }
  return best;
}

/** Verifica se o corredor de largura 2·r entre p e q está livre de bolas (exceto ignoradas). */
export function pathClear(w: World, p: Vec, q: Vec, r: number, ignore: number[]): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L === 0) return true;
  const ux = dx / L;
  const uy = dy / L;
  for (const b of w.balls) {
    if (b.pocketed || ignore.includes(b.id)) continue;
    const bx = b.x - p.x;
    const by = b.y - p.y;
    const along = bx * ux + by * uy;
    if (along < 0 || along > L) {
      const de = Math.min(Math.hypot(b.x - p.x, b.y - p.y), Math.hypot(b.x - q.x, b.y - q.y));
      if (de < r) return false;
      continue;
    }
    const perp = Math.abs(bx * uy - by * ux);
    if (perp < r) return false;
  }
  return true;
}
