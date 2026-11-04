/** Medição da IA dos Blocos: pontos até acabar o espaço (mesma semente para todos os níveis). Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseBlocks } from '../../src/games/blocks/ai';
import { createBlocks, place } from '../../src/games/blocks/logic';

export function blocksAiScore(d: Difficulty, seed: number, maxMoves = 300): { score: number; moves: number; ms: number } {
  const s = createBlocks(seed);
  const rng = makeRng(seed + 99);
  let ms = 0;
  while (!s.over && s.moves < maxMoves) {
    const t0 = performance.now();
    const m = chooseBlocks(s, d, rng);
    ms += performance.now() - t0;
    if (!m) break;
    place(s, m.idx, m.r, m.c);
  }
  return { score: s.score, moves: s.moves, ms: ms / Math.max(1, s.moves) };
}
