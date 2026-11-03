/** Medição da IA do Lig-4: partidas IA × IA alternando quem começa. Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseC4 } from '../../src/games/connect4/ai';
import { createC4, play, validCols } from '../../src/games/connect4/logic';

export type C4Player = Difficulty | 'random';

/** % de pontos de A (vitória 1, empate 0,5) e tempo médio por jogada da IA mais forte (ms). */
export function c4Duel(a: C4Player, b: C4Player, n = 20, seed = 1): { score: number; ms: number } {
  let pts = 0;
  let ms = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 13 + i);
    const s = createC4((i % 2) as 0 | 1);
    const who: [C4Player, C4Player] = [a, b];
    while (s.winner === null) {
      const p = who[s.current];
      const t0 = performance.now();
      const c = p === 'random' ? validCols(s)[Math.floor(rng() * validCols(s).length)] : chooseC4(s, p, rng);
      if (p !== 'random') {
        ms += performance.now() - t0;
        k++;
      }
      play(s, c);
    }
    pts += s.winner === 0 ? 1 : s.winner === 'draw' ? 0.5 : 0;
  }
  return { score: pts / n, ms: ms / (k || 1) };
}
