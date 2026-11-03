/** Medição da IA do Cabo de Guerra (IA × IA). Números em docs/jogos/cabo-de-guerra.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { TugAI } from '../../src/games/tug/ai';
import { advance, createTug } from '../../src/games/tug/logic';

export function tugDuel(a: Difficulty, b: Difficulty, n = 60, seed = 9): { win: number; secs: number; draws: number } {
  let wins = 0;
  let secs = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 13 + i);
    const s = createTug();
    const aSide = (i % 2) as 0 | 1;
    const ais = [new TugAI(aSide === 0 ? a : b, 0, rng), new TugAI(aSide === 1 ? a : b, 1, rng)];
    for (let t = 0; !s.over; t += 1 / 120) {
      ais[0].update(s, t);
      ais[1].update(s, t);
      advance(s, t);
    }
    secs += s.t;
    if (s.winner === aSide) wins++;
    else if (s.winner === null) {
      wins += 0.5;
      draws++;
    }
  }
  return { win: wins / n, secs: secs / n, draws };
}
