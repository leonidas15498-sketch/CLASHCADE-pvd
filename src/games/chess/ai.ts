/**
 * IA do Xadrez: negamax com poda alfa-beta sobre as MESMAS regras do jogo (logic.ts).
 * Avaliação: material + tabelas de posição (centralização, peões avançados, rei protegido no meio-jogo e
 * ativo no final). Capturas primeiro (vítima mais valiosa × atacante mais barato) e busca de capturas no fim
 * da árvore (quiescência) para não "entregar" peça no último lance calculado.
 * - Fácil: 1 lance, sem quiescência, escolhe ao acaso entre lances até ~1,5 peão piores que o melhor.
 * - Médio: 2 lances + quiescência.
 * - Difícil: aprofundamento iterativo até 4 lances (+ quiescência) com limite de tempo.
 * Medido em tests/bench/chess.ts.
 */
import type { Difficulty } from '../shared/shell';
import { B, ChessState, inCheck, K, kind, KN, legalMoves, make, Move, P, posKey, Q, R, unmake } from './logic';

const VAL: Record<number, number> = { [P]: 100, [KN]: 310, [B]: 330, [R]: 500, [Q]: 900, [K]: 0 };

// tabelas do ponto de vista das brancas (linha 0 = 8ª fileira); valores clássicos simplificados
const PST: Record<number, number[]> = {
  [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KN]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

const MATE = 100000;

/** Avaliação do ponto de vista de quem joga (positivo = bom para o lado da vez). */
export function evaluate(s: ChessState): number {
  let score = 0;
  let nonPawn = 0;
  for (let i = 0; i < 64; i++) {
    const t = kind(s.board[i]);
    if (t && t !== P && t !== K) nonPawn += VAL[t];
  }
  const endgame = nonPawn <= 2600;
  for (let i = 0; i < 64; i++) {
    const v = s.board[i];
    if (!v) continue;
    const t = kind(v);
    const sq = v > 0 ? i : (7 - (i >> 3)) * 8 + (i & 7); // espelha a linha para as pretas
    const table = t === K && endgame ? KING_END : PST[t];
    const val = VAL[t] + table[sq];
    score += v > 0 ? val : -val;
  }
  return s.current === 0 ? score : -score;
}

function order(moves: Move[], board: number[]) {
  const key = (m: Move) => (m.captured ? 10 * VAL[kind(m.captured)] - VAL[kind(board[m.from])] + 10000 : 0) + (m.promo ? 8000 : 0);
  return moves.sort((a, b) => key(b) - key(a));
}

interface Ctx {
  /** Posições já vistas (na partida e no caminho da busca): voltar a uma delas conta como empate (0). */
  seen: Set<string>;
  deadline: number;
  nodes: number;
  stop: boolean;
}

function quiesce(s: ChessState, alpha: number, beta: number, ctx: Ctx, depth = 0): number {
  ctx.nodes++;
  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth > 6) return alpha;
  for (const m of order(legalMoves(s, true), s.board)) {
    const u = make(s, m);
    const v = -quiesce(s, -beta, -alpha, ctx, depth + 1);
    unmake(s, m, u);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(s: ChessState, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx, qs: boolean): number {
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) ctx.stop = true;
  if (ctx.stop) return 0;
  // regra dos 50 lances dentro da busca
  if (s.halfmove >= 100) return 0;
  // repetição vale 0: quem está ganhando evita repetir; quem está perdendo procura repetir
  const key = posKey(s);
  if (ctx.seen.has(key)) return 0;
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
  if (depth <= 0) return qs ? quiesce(s, alpha, beta, ctx) : evaluate(s);
  let best = -Infinity;
  ctx.seen.add(key);
  for (const m of order(moves, s.board)) {
    const u = make(s, m);
    const v = -negamax(s, depth - 1, -beta, -alpha, ply + 1, ctx, qs);
    unmake(s, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  ctx.seen.delete(key);
  return best;
}

const CFG: Record<Difficulty, { depth: number; qs: boolean; ms: number; slack: number }> = {
  easy: { depth: 1, qs: false, ms: 300, slack: 150 },
  medium: { depth: 2, qs: true, ms: 1200, slack: 0 },
  hard: { depth: 4, qs: true, ms: 1500, slack: 0 },
};

/** Escolhe o lance da IA. `ms` sobrescreve o limite de tempo (para os testes). */
export function chooseChess(s0: ChessState, d: Difficulty, rng: () => number, ms?: number): Move {
  const s: ChessState = { ...s0, board: s0.board.slice(), castling: [...s0.castling] as ChessState['castling'] };
  const moves = order(legalMoves(s), s.board);
  if (moves.length === 1) return moves[0];
  const cfg = CFG[d];
  const ctx: Ctx = { seen: new Set([...s0.seen.keys()]), deadline: performance.now() + (ms ?? cfg.ms), nodes: 0, stop: false };
  let scored = moves.map((m) => ({ m, v: 0 }));
  let bestDone: Array<{ m: Move; v: number }> | null = null;
  // aprofundamento iterativo: começa raso e vai fundo enquanto houver tempo; a melhor da iteração anterior vai primeiro
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const cur: Array<{ m: Move; v: number }> = [];
    let alpha = -Infinity;
    for (const { m } of scored) {
      const u = make(s, m);
      // janela cheia no Fácil (precisa do valor exato de todos para sortear); nos outros, só o melhor é exato e
      // os demais são limites superiores (ficam atrás dele). Ruído só no Fácil: no alfa-beta ele trocaria o melhor
      // lance por um lance "cortado" (bug medido em 04/11: o Médio entregava torre).
      const raw = -negamax(s, depth - 1, -Infinity, cfg.slack ? Infinity : -alpha, 1, ctx, cfg.qs);
      unmake(s, m, u);
      if (ctx.stop) break;
      const better = raw > alpha;
      cur.push({ m, v: cfg.slack ? raw + rng() * 3 : better ? raw : Math.min(raw, alpha) - 1 });
      if (better) alpha = raw;
    }
    if (ctx.stop && bestDone) break;
    if (cur.length === scored.length) {
      cur.sort((a, b) => b.v - a.v);
      bestDone = cur;
      scored = cur;
    }
    if (ctx.stop) break;
  }
  const list = bestDone ?? scored;
  if (cfg.slack) {
    const ok = list.filter((x) => x.v >= list[0].v - cfg.slack);
    return ok[Math.floor(rng() * ok.length)].m;
  }
  return list[0].m;
}
