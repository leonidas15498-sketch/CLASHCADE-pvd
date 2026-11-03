/** Medição da IA do Empilha. Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseStackDrop } from '../../src/games/stack/ai';
import { StackMatch } from '../../src/games/stack/logic';

function playTurn(m: StackMatch, d: Difficulty, rng: () => number) {
  const c = chooseStackDrop(m, d, rng);
  m.drop(c.x, c.angle);
  let r = null;
  while (r === null) r = m.tick();
  return r;
}

/** Sozinha: quantas peças a IA empilha antes de derrubar (limite `cap`). */
export function soloHeight(d: Difficulty, n = 8, cap = 25, seed = 1): { pieces: number; ms: number } {
  let tot = 0;
  let ms = 0;
  let turns = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 77 + i);
    const m = new StackMatch(1, rng);
    while (m.phase !== 'over' && m.placed < cap) {
      const t0 = performance.now();
      const c = chooseStackDrop(m, d, rng);
      ms += performance.now() - t0;
      turns++;
      m.drop(c.x, c.angle);
      let r = null;
      while (r === null) r = m.tick();
    }
    tot += m.placed;
  }
  return { pieces: tot / n, ms: ms / turns };
}

/** IA × IA: % de partidas que A vence (alternando quem começa). */
export function stackDuel(a: Difficulty, b: Difficulty, n = 10, seed = 5): number {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 31 + i);
    const m = new StackMatch(2, rng);
    const aIs = (i % 2) as 0 | 1;
    let turns = 0;
    while (m.phase !== 'over' && turns < 60) {
      playTurn(m, m.current === aIs ? a : b, rng);
      turns++;
    }
    if (m.loser !== null && m.loser !== aIs) wins++;
    else if (m.loser === null) wins += 0.5;
  }
  return wins / n;
}
