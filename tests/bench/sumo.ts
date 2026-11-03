/** Medição da IA do Sumô Neon (IA × IA). Números no STATUS.md / docs/jogos/sumo.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { SumoAI } from '../../src/games/sumo/ai';
import { createSumo, stepSumo } from '../../src/games/sumo/logic';

/** % de partidas (melhor de 3) que A vence contra B, alternando os lados; e duração média (s). */
export function sumoDuel(a: Difficulty, b: Difficulty, n = 40, seed = 3): { win: number; secs: number; roundSecs: number } {
  let wins = 0;
  let secs = 0;
  let rounds = 0;
  let roundT = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 101 + i);
    const s = createSumo();
    const aSide = (i % 2) as 0 | 1;
    const ais = [new SumoAI(aSide === 0 ? a : b, 0, rng), new SumoAI(aSide === 1 ? a : b, 1, rng)];
    let lastRt = 0;
    while (s.winner === null && s.t < 300) {
      ais[0].update(s, 1 / 120);
      ais[1].update(s, 1 / 120);
      const before = s.events.length;
      stepSumo(s);
      for (let k = before; k < s.events.length; k++) {
        const e = s.events[k];
        if (e.type === 'out' || e.type === 'timeout') {
          rounds++;
          roundT += s.rt;
        }
      }
      lastRt = s.rt;
    }
    void lastRt;
    secs += s.t;
    if (s.winner === aSide) wins++;
    else if (s.winner === null) wins += 0.5;
  }
  return { win: wins / n, secs: secs / n, roundSecs: roundT / Math.max(1, rounds) };
}
