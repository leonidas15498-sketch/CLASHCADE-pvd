import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { solveLevel } from '../../src/games/minigolf/levels/solver';
import { pointInPoly } from '../../src/games/minigolf/physics/sim';
import { GOLF } from '../../src/games/minigolf/physics/types';

function distSeg(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
}

describe('minigolfe — buracos', () => {
  it('são 12 fases diferentes, com par e nome', () => {
    expect(LEVELS.length).toBe(12);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(12);
    expect(LEVELS.some((l) => l.movers.length > 0)).toBe(true);
    expect(LEVELS.slice(0, 3).every((l) => l.movers.length === 0)).toBe(true); // as 3 primeiras ensinam
  });

  for (const lv of LEVELS) {
    it(`buraco ${lv.id} (${lv.name}): saída livre e buraco dentro do gramado`, () => {
      expect(pointInPoly(lv.tee, lv.green)).toBe(true);
      expect(pointInPoly(lv.hole, lv.green)).toBe(true);
      for (const w of lv.walls) expect(distSeg(lv.tee, w.a, w.b)).toBeGreaterThan(GOLF.ballR + w.r);
      for (const b of lv.bumpers) expect(Math.hypot(lv.tee.x - b.c.x, lv.tee.y - b.c.y)).toBeGreaterThan(GOLF.ballR + b.r);
    });

    it(`buraco ${lv.id} (${lv.name}): solucionável em até 10 tacadas`, () => {
      const s = solveLevel(lv);
      expect(s).not.toBeNull();
      console.log(`buraco ${lv.id} ${lv.name}: par ${lv.par}, resolvido em ${s!.strokes}`);
      expect(s!.strokes).toBeLessThanOrEqual(10);
    }, 120_000);
  }
});
