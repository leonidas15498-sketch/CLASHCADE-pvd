/**
 * Medição do Blocos Cromáticos com robôs (não são pessoas): calibra as faixas de pontuação.
 * - 'random': coloca uma peça qualquer num lugar qualquer que caiba (jogador distraído).
 * - 'greedy': escolhe a jogada que mais pontua agora e deixa a grade mais "arrumada" (jogador atento).
 * - 'planner': igual, mas olha também a próxima peça da bandeja (jogador bom).
 */
import { BlocksState, canPlace, createBlocks, N, place, Shape, shapeById } from '../../src/games/blocks/logic';

export type Bot = 'random' | 'greedy' | 'planner';

function holesPenalty(g: Uint8Array): number {
  // quadradinhos vazios cercados (difíceis de preencher) + bordas irregulares
  let pen = 0;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = g[r * N + c];
      if (v) continue;
      let blocked = 0;
      if (r === 0 || g[(r - 1) * N + c]) blocked++;
      if (r === N - 1 || g[(r + 1) * N + c]) blocked++;
      if (c === 0 || g[r * N + c - 1]) blocked++;
      if (c === N - 1 || g[r * N + c + 1]) blocked++;
      if (blocked === 4) pen += 3;
      else if (blocked === 3) pen += 1;
    }
  return pen;
}

const BIG = ['o3', 'i50', 'i51', 'r230', 'r231'].map((id) => shapeById(id)!);
/** Quantas peças grandes ainda cabem em algum lugar (espaço aberto = sobrevive mais). */
function roomFor(g: Uint8Array): number {
  let n = 0;
  for (const sh of BIG) {
    for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) if (canPlace(g, sh, r, c)) n++;
  }
  return Math.min(n, 30);
}

function options(s: BlocksState) {
  const out: { i: number; r: number; c: number }[] = [];
  s.tray.forEach((p, i) => {
    if (!p) return;
    const sh: Shape = p.shape;
    for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) if (canPlace(s.grid, sh, r, c)) out.push({ i, r, c });
  });
  return out;
}

function clone(s: BlocksState): BlocksState {
  return { ...s, grid: s.grid.slice(), tray: [...s.tray], rng: () => 0.5 };
}

export function playGame(bot: Bot, seed: number, maxMoves = 3000) {
  const s = createBlocks(seed);
  const pick = createBlocks(seed + 99991).rng;
  while (!s.over && s.moves < maxMoves) {
    const ops = options(s);
    if (!ops.length) break;
    let best = ops[Math.floor(pick() * ops.length)];
    if (bot !== 'random') {
      let bestV = -Infinity;
      for (const o of ops) {
        const t = clone(s);
        const res = place(t, o.i, o.r, o.c)!;
        const filled = t.grid.reduce((a, v) => a + (v ? 1 : 0), 0);
        let v = res.total * 2 - holesPenalty(t.grid) * 4 - filled * 0.6 + roomFor(t.grid) * 0.8;
        if (bot === 'planner' && t.tray.some((x) => x) && !t.over) {
          // olha uma jogada adiante com as peças que sobram na bandeja
          let best2 = -Infinity;
          for (const o2 of options(t)) {
            const u = clone(t);
            const r2 = place(u, o2.i, o2.r, o2.c)!;
            const f2 = u.grid.reduce((a, x) => a + (x ? 1 : 0), 0);
            best2 = Math.max(best2, r2.total * 2 - holesPenalty(u.grid) * 4 - f2 * 0.6 + roomFor(u.grid) * 0.8);
          }
          v = res.total * 2 + (best2 === -Infinity ? -200 : best2);
        }
        if (v > bestV) {
          bestV = v;
          best = o;
        }
      }
    }
    place(s, best.i, best.r, best.c);
  }
  return { score: s.score, moves: s.moves, lines: s.lines, bestStreak: s.bestStreak, capped: s.moves >= maxMoves };
}

export function benchBlocks(bot: Bot, n = 40, seed = 1) {
  const scores: number[] = [];
  let moves = 0;
  let capped = 0;
  let streak = 0;
  for (let i = 0; i < n; i++) {
    const g = playGame(bot, seed * 7919 + i);
    scores.push(g.score);
    moves += g.moves;
    streak += g.bestStreak;
    if (g.capped) capped++;
  }
  scores.sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(n - 1, Math.floor(p * n))];
  return { p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), moves: moves / n, bestStreak: streak / n, capped };
}
