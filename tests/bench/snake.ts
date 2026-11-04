/** Medição da IA da Cobrinha: % de rodadas que A vence contra B (lados alternados). Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { thinkSnake } from '../../src/games/snake/ai';
import { createSnakeGame, step } from '../../src/games/snake/logic';

export function snakeDuel(a: Difficulty, b: Difficulty, n = 60, seed = 5): { winA: number; draws: number } {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 977 + i);
    const s = createSnakeGame(2, rng);
    const aSide = i % 2;
    let guard = 0;
    while (s.result === null && guard++ < 3000) {
      thinkSnake(s, 0, aSide === 0 ? a : b, rng);
      thinkSnake(s, 1, aSide === 1 ? a : b, rng);
      step(s);
    }
    if (s.result === aSide) wins++;
    else if (s.result === 'draw' || s.result === null) draws++;
  }
  return { winA: wins / n, draws: draws / n };
}

/** Solo: média de frutas da IA sozinha até bater (mostra se a IA "sabe jogar"). */
export function snakeSolo(d: Difficulty, n = 20, seed = 9): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 31 + i);
    const s = createSnakeGame(1, rng);
    let guard = 0;
    while (s.result === null && guard++ < 6000) {
      thinkSnake(s, 0, d, rng);
      step(s);
    }
    total += s.snakes[0].eaten;
  }
  return total / n;
}
