/** Medição da IA do Minigolfe: tacadas da IA sozinha nos 9 buracos (menos = melhor). Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseGolfShot } from '../../src/games/minigolf/ai';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { simulateShot } from '../../src/games/minigolf/physics/sim';

/** Total de tacadas no circuito (fora de campo = +1 e volta ao ponto anterior; teto 10 por buraco, como na regra). */
export function golfRound(d: Difficulty, seed = 1): { total: number; ms: number } {
  const rng = makeRng(seed);
  let total = 0;
  let ms = 0;
  let shots = 0;
  for (const lv of LEVELS) {
    let pos = lv.tee;
    let t = 0;
    let strokes = 0;
    while (strokes < 10) {
      const t0 = performance.now();
      const s = chooseGolfShot(lv, pos, t, d, rng);
      ms += performance.now() - t0;
      shots++;
      const r = simulateShot(lv, pos, t, s.angle, s.power);
      strokes++;
      if (r.status === 'holed') break;
      if (r.status === 'out') strokes++;
      else pos = { x: r.x, y: r.y };
      t = r.t + 2;
    }
    total += Math.min(10, strokes);
  }
  return { total, ms: ms / shots };
}
