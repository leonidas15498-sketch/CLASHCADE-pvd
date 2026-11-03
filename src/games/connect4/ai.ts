import type { Difficulty } from '../shared/shell';
import { C4State, COLS, height, play, ROWS, undo, validCols } from './logic';

/**
 * IA do Lig-4: busca minimax com poda alfa-beta (olha N jogadas à frente) e uma avaliação por janelas de 4 casas.
 * - Fácil: olha só 1 jogada (ganha se puder, às vezes não bloqueia), e 35% das vezes joga numa coluna qualquer.
 * - Médio: olha 4 jogadas; 8% das vezes escolhe a 2ª melhor.
 * - Difícil: olha 8 jogadas, prefere o centro e nunca "relaxa".
 */
export interface C4Cfg {
  depth: number;
  randomMove: number;
  secondBest: number;
}
export const C4_AI: Record<Difficulty, C4Cfg> = {
  easy: { depth: 1, randomMove: 0.35, secondBest: 0.25 },
  medium: { depth: 4, randomMove: 0, secondBest: 0.08 },
  hard: { depth: 8, randomMove: 0, secondBest: 0 },
};

const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

function windowScore(a: number, b: number, me: number): number {
  // a = minhas peças na janela, b = do rival (janela com as duas não vale nada)
  if (a && b) return 0;
  if (a === 3) return 50;
  if (a === 2) return 8;
  if (b === 3) return -60;
  if (b === 2) return -8;
  return me * 0;
}

/** Avaliação da posição do ponto de vista do jogador `p` (0/1). */
export function evaluate(s: C4State, p: 0 | 1): number {
  const me = p + 1;
  let score = 0;
  for (let r = 0; r < ROWS; r++) if (s.cells[3][r] === me) score += 6;
  else if (s.cells[3][r] !== 0) score -= 6;
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      for (const [dc, dr] of dirs) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        let a = 0;
        let b = 0;
        for (let k = 0; k < 4; k++) {
          const v = s.cells[c + dc * k][r + dr * k];
          if (v === me) a++;
          else if (v) b++;
        }
        score += windowScore(a, b, me);
      }
  return score;
}

function negamax(s: C4State, depth: number, alpha: number, beta: number): number {
  const p = s.current;
  if (depth === 0) return evaluate(s, p);
  const cols = ORDER.filter((c) => height(s, c) < ROWS);
  if (!cols.length) return 0;
  // vitória imediata
  for (const c of cols) {
    play(s, c);
    const w = s.winner;
    undo(s);
    if (w === p) return WIN + depth;
  }
  let best = -Infinity;
  for (const c of cols) {
    play(s, c);
    const v = s.winner === 'draw' ? 0 : -negamax(s, depth - 1, -beta, -alpha);
    undo(s);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Notas de cada coluna válida (maior = melhor para quem joga). */
export function scoreColumns(s: C4State, depth: number): Array<{ c: number; v: number }> {
  const out: Array<{ c: number; v: number }> = [];
  for (const c of ORDER) {
    if (height(s, c) >= ROWS) continue;
    const p = s.current;
    play(s, c);
    const v = s.winner === p ? WIN + depth + 1 : s.winner === 'draw' ? 0 : -negamax(s, depth - 1, -Infinity, Infinity);
    undo(s);
    out.push({ c, v });
  }
  return out;
}

export function chooseC4(s: C4State, d: Difficulty, rng: () => number = Math.random): number {
  const cfg = C4_AI[d];
  const valid = validCols(s);
  if (rng() < cfg.randomMove) return valid[Math.floor(rng() * valid.length)];
  const sc = scoreColumns(s, cfg.depth).sort((a, b) => b.v - a.v);
  // nunca deixa de ganhar na hora; o "erro" só acontece se não houver vitória imediata
  if (sc.length > 1 && sc[0].v < WIN && rng() < cfg.secondBest) return sc[1].c;
  const top = sc.filter((x) => x.v === sc[0].v);
  return top[Math.floor(rng() * top.length)].c;
}
