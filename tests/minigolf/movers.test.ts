import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { createWorld, inMoverSweep, moverSegments, pointInPoly, step, strike } from '../../src/games/minigolf/physics/sim';
import { GOLF, Level, Vec } from '../../src/games/minigolf/physics/types';

/**
 * Pedido do Leon (05/11): obstáculos que se mexem (moinho, portão) não podem bugar a bola.
 * Antes: no Portão a bola era espremida contra a parede e saía "fora" (≈2% das tacadas, com penalidade);
 * na Grande Final a bola parada perto do moinho ia parar dentro da parede ou do bloco. Fuzz completo:
 * `npx vite-node scripts/golfe-moveis.ts 6000`.
 */
const R = GOLF.ballR;
const dSeg = (p: Vec, a: Vec, b: Vec) => {
  const ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2)) : 0;
  return Math.hypot(p.x - a.x - ex * t, p.y - a.y - ey * t);
};
const inStatic = (L: Level, p: Vec) => L.walls.some((w) => dSeg(p, w.a, w.b) < R + w.r - 0.05) || L.blocks.some((b) => pointInPoly(p, b));

describe('minigolfe — obstáculos móveis', () => {
  for (const L of LEVELS.filter((l) => l.movers.length)) {
    it(`buraco ${L.id} (${L.name}): sem fora indevido, sem bola presa, parada sempre em lugar livre`, () => {
      let seed = 99 + L.id;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const bad: string[] = [];
      for (let i = 0; i < 700; i++) {
        let from: Vec;
        do from = { x: L.bounds.x + rnd() * L.bounds.w, y: L.bounds.y + rnd() * L.bounds.h };
        while (!pointInPoly(from, L.green) || inStatic(L, from) || inMoverSweep(L, from, R) || L.zones.some((z) => z.kind === 'water' && pointInPoly(from, z.poly)));
        const w = createWorld(L, from, rnd() * 20);
        strike(w, rnd() * Math.PI * 2, 0.05 + rnd() * 0.95);
        while (w.status === 'moving') {
          step(w);
          if (w.status === 'moving' && inStatic(L, w)) bad.push(`atravessou parede (${w.x.toFixed(1)},${w.y.toFixed(1)})`);
        }
        const temAgua = (L.openEdges?.length ?? 0) > 0 || L.zones.some((z) => z.kind === 'water');
        if (w.status === 'out' && !temAgua) bad.push('fora de campo sem água');
        if (w.status === 'out' && temAgua && !L.zones.some((z) => z.kind === 'water' && pointInPoly(w, z.poly)) && pointInPoly(w, L.green)) bad.push('fora sem estar na água');
        if (w.shotTime > GOLF.maxShotSeconds) bad.push('presa');
        if (w.status === 'rest') {
          if (inStatic(L, w) || !pointInPoly(w, L.green)) bad.push('parou dentro de parede');
          for (let k = 0; k < 400; k++) for (const m of L.movers) for (const s of moverSegments(m, w.t + k / 40)) if (dSeg(w, s.a, s.b) < R + s.r - 0.05) { bad.push('obstáculo atravessa bola parada'); k = 1e9; }
        }
      }
      expect(bad.slice(0, 3)).toEqual([]);
    });
  }
});
