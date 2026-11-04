/**
 * IA das Damas: minimax com poda alfa-beta sobre as MESMAS regras do jogo (logic.ts).
 * Avaliação: material (pedra 100, dama 320) + avanço das pedras + controle do centro + base guardada.
 * Fácil: 1 lance de profundidade e escolhe ao acaso entre lances "bons o bastante".
 * Médio: 3 lances. Difícil: 6 lances. Medido em tests/bench/checkers.ts.
 */
import type { Difficulty } from '../shared/shell';
import { applyMove, CheckersState, clone, isKing, legalMoves, Move, N, rc, Side, sideOf } from './logic';

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 3, hard: 6 };

export function evaluate(s: CheckersState, me: Side): number {
  if (s.winner === 'draw') return 0;
  if (s.winner !== null) return s.winner === me ? 100000 - s.plies : -100000 + s.plies;
  let score = 0;
  for (let i = 0; i < N * N; i++) {
    const v = s.board[i];
    const side = sideOf(v);
    if (side === null) continue;
    const [r, c] = rc(i);
    let val: number;
    if (isKing(v)) val = 320;
    else {
      const adv = side === 0 ? N - 1 - r : r; // 0..7 quanto já andou
      val = 100 + adv * 4;
      if (adv === 0) val += 8; // pedra na última linha de casa protege contra dama
    }
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) val += 5;
    score += side === me ? val : -val;
  }
  return score;
}

function search(s: CheckersState, depth: number, alpha: number, beta: number, me: Side): number {
  if (depth === 0 || s.winner !== null) return evaluate(s, me);
  const moves = legalMoves(s);
  const max = s.current === me;
  let best = max ? -Infinity : Infinity;
  for (const m of moves) {
    const n = clone(s);
    applyMove(n, m);
    // captura obrigatória em sequência não conta como profundidade "gasta" quando só há 1 lance (evita horizonte bobo)
    const v = search(n, moves.length === 1 ? depth : depth - 1, alpha, beta, me);
    if (max) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseCheckers(s: CheckersState, d: Difficulty, rng: () => number): Move {
  const moves = legalMoves(s);
  if (moves.length === 1) return moves[0];
  const me = s.current;
  const scored = moves.map((m) => {
    const n = clone(s);
    applyMove(n, m);
    return { m, v: search(n, DEPTH[d] - 1, -Infinity, Infinity, me) + rng() * 0.5 };
  });
  scored.sort((a, b) => b.v - a.v);
  if (d === 'easy') {
    // escolhe ao acaso entre os lances até 60 pontos piores que o melhor (às vezes entrega uma pedra)
    const ok = scored.filter((x) => x.v >= scored[0].v - 60);
    return ok[Math.floor(rng() * ok.length)].m;
  }
  return scored[0].m;
}
