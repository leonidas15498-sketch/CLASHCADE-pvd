/** Medição da IA das Damas: % de partidas que A vence contra B (alternando quem começa). Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseCheckers } from '../../src/games/checkers/ai';
import { applyMove, createCheckers } from '../../src/games/checkers/logic';

export function checkersDuel(a: Difficulty, b: Difficulty, n = 10, seed = 3): { winA: number; draws: number } {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 101 + i);
    const s = createCheckers(0);
    const aSide = i % 2 === 0 ? 0 : 1;
    let guard = 0;
    while (s.winner === null && guard++ < 300) {
      const d = s.current === aSide ? a : b;
      applyMove(s, chooseCheckers(s, d, rng));
    }
    if (s.winner === aSide) wins++;
    else if (s.winner === 'draw' || s.winner === null) draws++;
  }
  return { winA: wins / n, draws: draws / n };
}
