/** Medição da IA do Ludo: % de partidas que A vence contra B (2 jogadores, alternando quem começa). */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseLudo } from '../../src/games/ludo/ai';
import { createLudo, moveToken, roll } from '../../src/games/ludo/logic';

export function ludoDuel(a: Difficulty, b: Difficulty, n = 400, seed = 7): { winA: number; turns: number } {
  let wins = 0;
  let turns = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 131 + i);
    const s = createLudo(2, i % 2);
    const aSide = 0;
    let guard = 0;
    while (s.winner === null && guard++ < 5000) {
      const r = roll(s, 1 + Math.floor(rng() * 6));
      if (r !== 'choose') continue;
      moveToken(s, chooseLudo(s, s.current === aSide ? a : b, rng));
    }
    if (s.winner === aSide) wins++;
    turns += s.turns;
  }
  return { winA: wins / n, turns: turns / n };
}
