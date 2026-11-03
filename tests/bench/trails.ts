/** Medição da IA do Duelo de Rastros: rodadas IA × IA, alternando os lados. Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { TrailsAI } from '../../src/games/trails/ai';
import { createRound, stepRound } from '../../src/games/trails/logic';

/** % de rodadas decididas que A vence e duração média (passos). */
export function duel(a: Difficulty, b: Difficulty, n = 100, seed = 1): { winA: number; draws: number; steps: number } {
  let wa = 0;
  let decided = 0;
  let draws = 0;
  let steps = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 101 + i);
    const aSide = (i % 2) as 0 | 1;
    const s = createRound(Math.floor(rng() * 9) - 4);
    const ais = [new TrailsAI(aSide === 0 ? a : b, rng, 0), new TrailsAI(aSide === 0 ? b : a, rng, 1)];
    while (s.result === null && s.steps < 3000) {
      ais[0].think(s);
      ais[1].think(s);
      stepRound(s);
    }
    steps += s.steps;
    if (s.result === 'draw' || s.result === null) draws++;
    else {
      decided++;
      if (s.result === aSide) wa++;
    }
  }
  return { winA: wa / (decided || 1), draws: draws / n, steps: steps / n };
}
