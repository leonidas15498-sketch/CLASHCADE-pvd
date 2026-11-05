/**
 * Xadrez — regras puras (sem DOM), regras oficiais da FIDE:
 * - Movimentos de todas as peças, roque (dos dois lados, sem passar por casa atacada e sem estar em xeque),
 *   captura en passant, promoção (escolha de dama, torre, bispo ou cavalo).
 * - Só lances legais (não pode deixar o próprio rei em xeque).
 * - Fim: xeque-mate; empates por afogamento, 50 lances sem captura nem movimento de peão, tripla repetição
 *   e material insuficiente (rei×rei, rei+bispo ou rei+cavalo × rei, reis com bispos da mesma cor).
 * Jogador 1 (coral) = brancas, embaixo, começa. Jogador 2 (azul / IA) = pretas.
 * Casas: índice = linha·8 + coluna; linha 0 é a de cima (8ª fileira), coluna 0 = coluna "a".
 */
export const N = 8;
export const P = 1, KN = 2, B = 3, R = 4, Q = 5, K = 6;
/** Valores na casa: 0 vazia; positivo = brancas (lado 0); negativo = pretas (lado 1). */
export type Side = 0 | 1;
export type Result = Side | 'draw' | null;
export type EndReason = 'mate' | 'stalemate' | 'fifty' | 'repetition' | 'material' | null;

export interface Move {
  from: number;
  to: number;
  /** Peça da promoção (2..5), se houver. */
  promo?: number;
  /** Peça capturada (valor com sinal), 0 se nenhuma. */
  captured: number;
  ep?: boolean;
  castle?: 'K' | 'Q';
}

export interface ChessState {
  board: number[];
  current: Side;
  /** Roque ainda possível: [brancas lado do rei, brancas lado da dama, pretas lado do rei, pretas lado da dama]. */
  castling: [boolean, boolean, boolean, boolean];
  /** Casa de captura en passant (atrás do peão que andou 2), ou -1. */
  ep: number;
  /** Meios-lances desde a última captura ou movimento de peão (regra dos 50 lances = 100). */
  halfmove: number;
  plies: number;
  /** Quantas vezes cada posição já apareceu (tripla repetição). */
  seen: Map<string, number>;
  winner: Result;
  reason: EndReason;
}

export const rc = (i: number): [number, number] => [i >> 3, i & 7];
export const idx = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const sideOf = (v: number): Side | null => (v > 0 ? 0 : v < 0 ? 1 : null);
export const kind = (v: number) => Math.abs(v);

const KNIGHT: Array<[number, number]> = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING: Array<[number, number]> = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** `first`: quem faz o 1º lance (05/11: sorteado). As peças de quem começa ficam embaixo no jogo (lado 0 = coral). */
export function createChess(first: Side = 0): ChessState {
  const back = [R, KN, B, Q, K, B, KN, R];
  const board = Array(64).fill(0);
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = -back[c];
    board[idx(1, c)] = -P;
    board[idx(6, c)] = P;
    board[idx(7, c)] = back[c];
  }
  const s: ChessState = { board, current: first, castling: [true, true, true, true], ep: -1, halfmove: 0, plies: 0, seen: new Map(), winner: null, reason: null };
  s.seen.set(posKey(s), 1);
  return s;
}

/** Monta uma posição a partir de FEN (só as 4 primeiras partes importam). Útil nos testes. */
export function fromFen(fen: string): ChessState {
  const [pos, turn, cast, ep] = fen.trim().split(/\s+/);
  const map: Record<string, number> = { p: P, n: KN, b: B, r: R, q: Q, k: K };
  const board = Array(64).fill(0);
  pos.split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) c += Number(ch);
      else {
        const v = map[ch.toLowerCase()];
        board[idx(r, c)] = ch === ch.toUpperCase() ? v : -v;
        c++;
      }
    }
  });
  const castling: ChessState['castling'] = [cast.includes('K'), cast.includes('Q'), cast.includes('k'), cast.includes('q')];
  const epSq = ep && ep !== '-' ? idx(8 - Number(ep[1]), ep.charCodeAt(0) - 97) : -1;
  const s: ChessState = { board, current: turn === 'b' ? 1 : 0, castling, ep: epSq, halfmove: 0, plies: 0, seen: new Map(), winner: null, reason: null };
  s.seen.set(posKey(s), 1);
  return s;
}

export function clone(s: ChessState): ChessState {
  return { ...s, board: s.board.slice(), castling: [...s.castling] as ChessState['castling'], seen: new Map(s.seen) };
}

export function posKey(s: ChessState) {
  return s.board.join(',') + '|' + s.current + '|' + s.castling.map(Number).join('') + '|' + s.ep;
}

/** A casa `sq` é atacada por alguma peça do lado `by`? */
export function attacked(board: number[], sq: number, by: Side): boolean {
  const [r, c] = rc(sq);
  const sgn = by === 0 ? 1 : -1;
  // peões: brancos atacam para cima (linha - 1), então quem ataca `sq` está numa linha abaixo
  const pr = by === 0 ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && board[idx(pr, c + dc)] === sgn * P) return true;
  for (const [dr, dc] of KNIGHT) if (inside(r + dr, c + dc) && board[idx(r + dr, c + dc)] === sgn * KN) return true;
  for (const [dr, dc] of KING) if (inside(r + dr, c + dc) && board[idx(r + dr, c + dc)] === sgn * K) return true;
  const ray = (dirs: Array<[number, number]>, a: number, b: number) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const v = board[idx(rr, cc)];
        if (v) {
          if (v === sgn * a || v === sgn * b) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return ray(DIAG, B, Q) || ray(ORTHO, R, Q);
}

export function kingSquare(board: number[], side: Side): number {
  const k = side === 0 ? K : -K;
  return board.indexOf(k);
}

export function inCheck(s: ChessState, side: Side = s.current): boolean {
  const k = kingSquare(s.board, side);
  return k >= 0 && attacked(s.board, k, side === 0 ? 1 : 0);
}

/** Lances que seguem o movimento das peças (podem deixar o rei em xeque). */
function pseudo(s: ChessState, capturesOnly = false): Move[] {
  const out: Move[] = [];
  const side = s.current;
  const sgn = side === 0 ? 1 : -1;
  const b = s.board;
  const enemy = (v: number) => v !== 0 && Math.sign(v) !== sgn;
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v || Math.sign(v) !== sgn) continue;
    const [r, c] = rc(i);
    const t = kind(v);
    if (t === P) {
      const dir = side === 0 ? -1 : 1;
      const start = side === 0 ? 6 : 1;
      const last = side === 0 ? 0 : 7;
      const push = (to: number, captured: number, ep = false) => {
        if (rc(to)[0] === last) for (const pr of [Q, R, B, KN]) out.push({ from: i, to, promo: pr, captured });
        else out.push({ from: i, to, captured, ep });
      };
      const f1 = r + dir;
      if (inside(f1, c) && !b[idx(f1, c)] && (!capturesOnly || f1 === last)) {
        push(idx(f1, c), 0);
        const f2 = r + 2 * dir;
        if (!capturesOnly && r === start && !b[idx(f2, c)]) out.push({ from: i, to: idx(f2, c), captured: 0 });
      }
      for (const dc of [-1, 1]) {
        if (!inside(f1, c + dc)) continue;
        const to = idx(f1, c + dc);
        if (enemy(b[to])) push(to, b[to]);
        else if (to === s.ep) push(to, -sgn * P, true);
      }
      continue;
    }
    const steps = (dirs: Array<[number, number]>, slide: boolean) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (inside(rr, cc)) {
          const to = idx(rr, cc);
          const w = b[to];
          if (w && !enemy(w)) break;
          if (w || !capturesOnly) out.push({ from: i, to, captured: w });
          if (w || !slide) break;
          rr += dr;
          cc += dc;
        }
      }
    };
    if (t === KN) steps(KNIGHT, false);
    else if (t === B) steps(DIAG, true);
    else if (t === R) steps(ORTHO, true);
    else if (t === Q) steps([...DIAG, ...ORTHO], true);
    else if (t === K) {
      steps(KING, false);
      if (capturesOnly) continue;
      const home = side === 0 ? 7 : 0;
      const opp: Side = side === 0 ? 1 : 0;
      if (r === home && c === 4 && !attacked(b, i, opp)) {
        const [ks, qs] = side === 0 ? [s.castling[0], s.castling[1]] : [s.castling[2], s.castling[3]];
        if (ks && b[idx(home, 7)] === sgn * R && !b[idx(home, 5)] && !b[idx(home, 6)] && !attacked(b, idx(home, 5), opp) && !attacked(b, idx(home, 6), opp))
          out.push({ from: i, to: idx(home, 6), captured: 0, castle: 'K' });
        if (qs && b[idx(home, 0)] === sgn * R && !b[idx(home, 1)] && !b[idx(home, 2)] && !b[idx(home, 3)] && !attacked(b, idx(home, 3), opp) && !attacked(b, idx(home, 2), opp))
          out.push({ from: i, to: idx(home, 2), captured: 0, castle: 'Q' });
      }
    }
  }
  return out;
}

interface Undo {
  castling: ChessState['castling'];
  ep: number;
  halfmove: number;
  moved: number;
}

/** Faz o lance só no tabuleiro (rápido; usado pela busca da IA). Devolve o que é preciso para desfazer. */
export function make(s: ChessState, m: Move): Undo {
  const u: Undo = { castling: [...s.castling] as ChessState['castling'], ep: s.ep, halfmove: s.halfmove, moved: s.board[m.from] };
  const b = s.board;
  const v = b[m.from];
  const sgn = Math.sign(v);
  b[m.from] = 0;
  if (m.ep) b[m.to + (sgn > 0 ? 8 : -8)] = 0;
  b[m.to] = m.promo ? sgn * m.promo : v;
  if (m.castle) {
    const home = sgn > 0 ? 7 : 0;
    if (m.castle === 'K') {
      b[idx(home, 7)] = 0;
      b[idx(home, 5)] = sgn * R;
    } else {
      b[idx(home, 0)] = 0;
      b[idx(home, 3)] = sgn * R;
    }
  }
  // direitos de roque: rei ou torre que saem, ou torre capturada na casa de origem
  const touch = (sq: number) => {
    if (sq === 60) s.castling[0] = s.castling[1] = false;
    if (sq === 4) s.castling[2] = s.castling[3] = false;
    if (sq === 63) s.castling[0] = false;
    if (sq === 56) s.castling[1] = false;
    if (sq === 7) s.castling[2] = false;
    if (sq === 0) s.castling[3] = false;
  };
  touch(m.from);
  touch(m.to);
  s.ep = kind(v) === P && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  s.halfmove = kind(v) === P || m.captured ? 0 : s.halfmove + 1;
  s.current = s.current === 0 ? 1 : 0;
  s.plies++;
  return u;
}

export function unmake(s: ChessState, m: Move, u: Undo): void {
  const b = s.board;
  const sgn = Math.sign(u.moved);
  b[m.from] = u.moved;
  b[m.to] = m.ep ? 0 : m.captured;
  if (m.ep) b[m.to + (sgn > 0 ? 8 : -8)] = m.captured;
  if (m.castle) {
    const home = sgn > 0 ? 7 : 0;
    if (m.castle === 'K') {
      b[idx(home, 5)] = 0;
      b[idx(home, 7)] = sgn * R;
    } else {
      b[idx(home, 3)] = 0;
      b[idx(home, 0)] = sgn * R;
    }
  }
  s.castling = u.castling;
  s.ep = u.ep;
  s.halfmove = u.halfmove;
  s.current = s.current === 0 ? 1 : 0;
  s.plies--;
}

/** Lances legais do lado da vez. `capturesOnly` (para a IA) traz só capturas e promoções. */
export function legalMoves(s: ChessState, capturesOnly = false): Move[] {
  if (s.winner !== null) return [];
  const side = s.current;
  const opp: Side = side === 0 ? 1 : 0;
  const out: Move[] = [];
  for (const m of pseudo(s, capturesOnly)) {
    const u = make(s, m);
    const k = kingSquare(s.board, side);
    if (!attacked(s.board, k, opp)) out.push(m);
    unmake(s, m, u);
  }
  return out;
}

function insufficient(board: number[]): boolean {
  const minors: Array<{ t: number; color: number }> = [];
  for (let i = 0; i < 64; i++) {
    const t = kind(board[i]);
    if (!t || t === K) continue;
    if (t === P || t === R || t === Q) return false;
    const [r, c] = rc(i);
    minors.push({ t, color: (r + c) % 2 });
  }
  if (minors.length <= 1) return true;
  // só bispos, todos na mesma cor de casa
  return minors.every((m) => m.t === B) && minors.every((m) => m.color === minors[0].color);
}

/** Aplica um lance legal na partida (com fim de jogo). */
export function applyMove(s: ChessState, m: Move): void {
  make(s, m);
  const key = posKey(s);
  const n = (s.seen.get(key) ?? 0) + 1;
  s.seen.set(key, n);
  const moves = legalMoves(s);
  if (!moves.length) {
    if (inCheck(s)) {
      s.winner = s.current === 0 ? 1 : 0;
      s.reason = 'mate';
    } else {
      s.winner = 'draw';
      s.reason = 'stalemate';
    }
  } else if (s.halfmove >= 100) {
    s.winner = 'draw';
    s.reason = 'fifty';
  } else if (n >= 3) {
    s.winner = 'draw';
    s.reason = 'repetition';
  } else if (insufficient(s.board)) {
    s.winner = 'draw';
    s.reason = 'material';
  }
}

const FILES = 'abcdefgh';
export const squareName = (i: number) => `${FILES[i & 7]}${8 - (i >> 3)}`;
const LETTER: Record<number, string> = { [KN]: 'C', [B]: 'B', [R]: 'T', [Q]: 'D', [K]: 'R' };

/** Notação curta em português (C = cavalo, B = bispo, T = torre, D = dama, R = rei). */
export function moveName(s: ChessState, m: Move): string {
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const t = kind(s.board[m.from]);
  const cap = m.captured ? 'x' : '';
  const from = t === P ? (cap ? FILES[m.from & 7] : '') : LETTER[t];
  return `${from}${cap}${squareName(m.to)}${m.promo ? '=' + LETTER[m.promo] : ''}`;
}
