/**
 * Damas — regras puras (sem DOM). Variante brasileira (a mais jogada no Brasil):
 * - Tabuleiro 8×8, 12 peças por lado nas casas escuras. Jogador 1 (coral) começa embaixo e sai primeiro.
 * - Pedra anda 1 casa na diagonal para a frente; CAPTURA para a frente e para trás.
 * - Captura é obrigatória e vale a "lei da maioria": entre as capturas possíveis, é obrigatório a que toma mais peças.
 * - Peças capturadas só saem no fim do lance e não podem ser puladas duas vezes.
 * - Dama "voadora": anda e captura em qualquer distância na diagonal.
 * - Pedra vira dama só se TERMINAR o lance na última linha.
 * - Perde quem não tem lance (sem peças ou bloqueado). Empate: 20 lances seguidos só de damas, sem captura.
 * Opção da casa (pedido do Leon, 04/11): `menBack = false` faz a pedra capturar SÓ para a frente (como no checkers
 * americano/inglês). O resto das regras brasileiras continua igual. Padrão: true (regra oficial brasileira).
 * Casas: índice = linha·8 + coluna; linha 0 é a de cima (lado do Jogador 2).
 */
export const N = 8;
/** Valores na casa: 0 vazia; ±1 pedra; ±2 dama. Positivo = Jogador 1 (0), negativo = Jogador 2 (1). */
export type Cell = number;
export type Side = 0 | 1;

export interface CheckersState {
  board: Cell[];
  current: Side;
  winner: Side | 'draw' | null;
  /** Lances seguidos só de damas, sem captura (empate em DRAW_PLIES). */
  quiet: number;
  plies: number;
  /** Pedra pode capturar para trás (regra oficial brasileira). */
  menBack: boolean;
}

export interface Move {
  /** Casas percorridas: origem, paradas intermediárias (em captura múltipla) e destino. */
  path: number[];
  captured: number[];
  promotes: boolean;
}

export const DRAW_PLIES = 20;
export const sideOf = (v: Cell): Side | null => (v > 0 ? 0 : v < 0 ? 1 : null);
export const isKing = (v: Cell) => Math.abs(v) === 2;
export const rc = (i: number): [number, number] => [Math.floor(i / N), i % N];
export const idx = (r: number, c: number) => r * N + c;
const inside = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
export const dark = (r: number, c: number) => (r + c) % 2 === 1;
const DIRS: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
/** Para onde a pedra de cada lado anda (Jogador 1 sobe = linha diminui). */
const FWD: Record<Side, number> = { 0: -1, 1: 1 };

export function createCheckers(first: Side = 0, menBack = true): CheckersState {
  const board: Cell[] = Array(N * N).fill(0);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (!dark(r, c)) continue;
      if (r <= 2) board[idx(r, c)] = -1;
      else if (r >= 5) board[idx(r, c)] = 1;
    }
  return { board, current: first, winner: null, quiet: 0, plies: 0, menBack };
}

export const clone = (s: CheckersState): CheckersState => ({ ...s, board: s.board.slice() });

/** Todas as sequências de captura a partir de `from` (busca em profundidade). */
function captures(board0: Cell[], from: number, side: Side, king: boolean, menBack: boolean): Move[] {
  const out: Move[] = [];
  // a casa de origem fica vazia durante o lance (a peça pode passar de novo por ela)
  const board = board0.slice();
  board[from] = 0;
  const enemy = (i: number) => board[i] !== 0 && sideOf(board[i]) !== side;
  const [r0, c0] = rc(from);
  const rec = (r: number, c: number, path: number[], taken: number[]) => {
    let extended = false;
    for (const [dr, dc] of DIRS) {
      if (!king && !menBack && dr !== FWD[side]) continue;
      let rr = r + dr;
      let cc = c + dc;
      if (king) while (inside(rr, cc) && board[idx(rr, cc)] === 0) {
        rr += dr;
        cc += dc;
      }
      if (!inside(rr, cc)) continue;
      const vi = idx(rr, cc);
      if (!enemy(vi) || taken.includes(vi)) continue;
      let lr = rr + dr;
      let lc = cc + dc;
      while (inside(lr, lc) && board[idx(lr, lc)] === 0) {
        extended = true;
        rec(lr, lc, [...path, idx(lr, lc)], [...taken, vi]);
        if (!king) break;
        lr += dr;
        lc += dc;
      }
    }
    if (!extended && taken.length) {
      const [er] = rc(path[path.length - 1]);
      out.push({ path, captured: taken, promotes: !king && er === (side === 0 ? 0 : N - 1) });
    }
  };
  rec(r0, c0, [from], []);
  return out;
}

/** Lances legais do jogador da vez (já aplicando captura obrigatória e lei da maioria). */
export function legalMoves(s: CheckersState): Move[] {
  if (s.winner !== null) return [];
  const side = s.current;
  const caps: Move[] = [];
  const quiet: Move[] = [];
  for (let i = 0; i < N * N; i++) {
    const v = s.board[i];
    if (sideOf(v) !== side) continue;
    const king = isKing(v);
    caps.push(...captures(s.board, i, side, king, s.menBack));
    const [r, c] = rc(i);
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== FWD[side]) continue;
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc) && s.board[idx(rr, cc)] === 0) {
        quiet.push({ path: [i, idx(rr, cc)], captured: [], promotes: !king && rr === (side === 0 ? 0 : N - 1) });
        if (!king) break;
        rr += dr;
        cc += dc;
      }
    }
  }
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.captured.length));
    return caps.filter((m) => m.captured.length === max);
  }
  return quiet;
}

/** Aplica o lance (sem conferir se é legal: use legalMoves). */
export function applyMove(s: CheckersState, m: Move): void {
  const from = m.path[0];
  const to = m.path[m.path.length - 1];
  const v = s.board[from];
  s.board[from] = 0;
  for (const c of m.captured) s.board[c] = 0;
  s.board[to] = m.promotes ? Math.sign(v) * 2 : v;
  s.quiet = m.captured.length === 0 && isKing(v) ? s.quiet + 1 : 0;
  s.plies++;
  s.current = s.current === 0 ? 1 : 0;
  if (legalMoves(s).length === 0) s.winner = s.current === 0 ? 1 : 0;
  else if (s.quiet >= DRAW_PLIES) s.winner = 'draw';
}

export function count(s: CheckersState, side: Side) {
  let men = 0;
  let kings = 0;
  for (const v of s.board)
    if (sideOf(v) === side) {
      if (isKing(v)) kings++;
      else men++;
    }
  return { men, kings };
}
