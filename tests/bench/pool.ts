/**
 * Medição da IA da sinuca (usada pelos testes e por scripts/bench.ts). Números registrados no STATUS.md.
 * - potRate: mesas aleatórias de meio de jogo (IA com grupo definido, sem bola na mão) → % de tacadas que encaçapam
 *   bola própria sem falta (a vez continua).
 * - match: partidas completas IA × IA → % de vitórias de A.
 */
import { chooseAIShot, makeRng } from '../../src/games/pool/ai/ai';
import { GameController } from '../../src/games/pool/game/controller';
import { Difficulty } from '../../src/games/pool/rules/rules';

export function randomTable(seed: number, nBalls = 7): GameController {
  const rng = makeRng(seed);
  const g = new GameController({ mode: 'ai', difficulty: 'hard' });
  const w = g.world;
  const R = w.params.ballRadius;
  const L = w.table.length;
  const W = w.table.width;
  // escolhe quais bolas ficam: branca, 8 e nBalls de cada grupo misturadas
  const solids = [1, 2, 3, 4, 5, 6, 7].sort(() => rng() - 0.5).slice(0, Math.ceil(nBalls / 2));
  const stripes = [9, 10, 11, 12, 13, 14, 15].sort(() => rng() - 0.5).slice(0, Math.floor(nBalls / 2));
  const keep = new Set([0, 8, ...solids, ...stripes]);
  const placed: Array<{ x: number; y: number }> = [];
  for (const b of w.balls) {
    if (!keep.has(b.id)) {
      b.pocketed = true;
      continue;
    }
    for (let k = 0; k < 500; k++) {
      const x = 0.12 + rng() * (L - 0.24);
      const y = 0.1 + rng() * (W - 0.2);
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > 2 * R + 0.01)) {
        b.x = b.px = x;
        b.y = b.py = y;
        placed.push({ x, y });
        break;
      }
    }
  }
  g.match = {
    ...g.match,
    isBreak: false,
    tableOpen: false,
    ballInHand: 'none',
    current: 1,
    players: [
      { ...g.match.players[0], group: 'stripes' },
      { ...g.match.players[1], group: 'solids' },
    ],
  };
  return g;
}

export function playShot(g: GameController, d: Difficulty, rng: () => number) {
  const s = chooseAIShot(g, d, rng);
  if (s.cuePos) g.placeCue(s.cuePos.x, s.cuePos.y);
  if (g.needsCall()) g.callPocket(s.calledPocket ?? 0);
  const ok = g.shoot(s.angle, s.power);
  while (g.phase === 'rolling') g.tick();
  return { s, ok };
}

export function potRate(d: Difficulty, n = 60, seed = 1000): { pot: number; foul: number } {
  let pot = 0;
  let foul = 0;
  for (let i = 0; i < n; i++) {
    const g = randomTable(seed + i);
    playShot(g, d, makeRng(seed * 7 + i));
    if (g.lastResult!.continued) pot++;
    if (g.lastResult!.foul) foul++;
  }
  return { pot: pot / n, foul: foul / n };
}

/** Partidas completas: A joga como jogador 0 nas partidas pares e como 1 nas ímpares. Retorna % de vitórias de A. */
export function matchRate(a: Difficulty, b: Difficulty, n = 10, seed = 50): number {
  let winsA = 0;
  for (let i = 0; i < n; i++) {
    const g = new GameController({ mode: 'local' });
    const rng = makeRng(seed + i);
    const aIs = (i % 2) as 0 | 1;
    let shots = 0;
    while (g.match.winner === null && shots < 400) {
      playShot(g, g.match.current === aIs ? a : b, rng);
      shots++;
    }
    if (g.match.winner === aIs) winsA++;
  }
  return winsA / n;
}

/** Sequência média: quantas bolas seguidas a IA encaçapa a partir de uma mesa aleatória (até perder a vez). */
export function runLength(d: Difficulty, n = 40, seed = 3000): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const g = randomTable(seed + i);
    const rng = makeRng(seed * 3 + i);
    for (let k = 0; k < 10 && g.match.winner === null; k++) {
      playShot(g, d, rng);
      if (!g.lastResult!.continued) break;
      total++;
    }
  }
  return total / n;
}
