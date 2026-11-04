import { describe, expect, it } from 'vitest';
import { chooseChess } from '../../src/games/chess/ai';
import { applyMove, ChessState, createChess, fromFen, legalMoves, make, Move, squareName, unmake } from '../../src/games/chess/logic';
import { chessDuel } from '../bench/chess';

/** Conta posições até a profundidade (perft): número de referência conhecido valida o gerador de lances. */
function perft(s: ChessState, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of legalMoves(s)) {
    const u = make(s, m);
    n += perft(s, d - 1);
    unmake(s, m, u);
  }
  return n;
}
const find = (s: ChessState, from: string, to: string, promo?: number): Move => {
  const m = legalMoves(s).find((x) => squareName(x.from) === from && squareName(x.to) === to && (promo === undefined || x.promo === promo));
  if (!m) throw new Error(`lance ${from}-${to} não encontrado`);
  return m;
};

describe('xadrez — gerador de lances (perft)', () => {
  it('posição inicial: 20, 400, 8902', () => {
    const s = createChess();
    expect(perft(s, 1)).toBe(20);
    expect(perft(s, 2)).toBe(400);
    expect(perft(s, 3)).toBe(8902);
  });
  it('"Kiwipete" (roque, en passant, promoção, cravadas): 48, 2039', () => {
    const s = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
    expect(perft(s, 1)).toBe(48);
    expect(perft(s, 2)).toBe(2039);
  });
  it('posição 3 (en passant com xeque descoberto): 14, 191, 2812', () => {
    const s = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
    expect(perft(s, 1)).toBe(14);
    expect(perft(s, 2)).toBe(191);
    expect(perft(s, 3)).toBe(2812);
  });
  it('posição 4 (promoções e roque): 6, 264, 9467', () => {
    const s = fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -');
    expect(perft(s, 1)).toBe(6);
    expect(perft(s, 2)).toBe(264);
    expect(perft(s, 3)).toBe(9467);
  });
});

describe('xadrez — fim de partida', () => {
  it('mate do pastor', () => {
    const s = createChess();
    for (const [a, b] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]) applyMove(s, find(s, a, b));
    expect(s.winner).toBe(0);
    expect(s.reason).toBe('mate');
  });
  it('afogamento é empate', () => {
    const s = fromFen('7k/5Q2/6K1/8/8/8/8/8 w - -');
    applyMove(s, find(s, 'f7', 'g7'));
    expect(s.reason).toBe('mate'); // Dg7 protegida pelo rei: mate (não afogamento)
    const t = fromFen('k7/8/1Q6/8/8/8/8/7K w - -');
    applyMove(t, find(t, 'h1', 'g1'));
    expect(t.winner).toBe('draw');
    expect(t.reason).toBe('stalemate');
  });
  it('tripla repetição e material insuficiente', () => {
    const s = createChess();
    for (let k = 0; k < 2; k++) for (const [a, b] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']]) applyMove(s, find(s, a, b));
    expect(s.winner).toBe('draw');
    expect(s.reason).toBe('repetition');
    const m = fromFen('k7/8/8/8/8/8/1n6/K7 w - -');
    applyMove(m, find(m, 'a1', 'b2'));
    expect(m.reason).toBe('material');
  });
  it('promoção pode escolher a peça', () => {
    const s = fromFen('8/P6k/8/8/8/8/8/K7 w - -');
    const opts = legalMoves(s).filter((x) => squareName(x.from) === 'a7');
    expect(opts.map((x) => x.promo).sort()).toEqual([2, 3, 4, 5]);
  });
});

describe('xadrez — IA', () => {
  it('acha mate em 1 e captura a dama solta', () => {
    const s = fromFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - -');
    const m = chooseChess(s, 'hard', () => 0.5, 2000);
    expect(squareName(m.to)).toBe('a8');
    // dama preta solta em d5 atacando a branca: tem que capturar já (senão perde a própria dama)
    const t = fromFen('4k3/8/8/3q4/8/8/3Q4/4K3 w - -');
    expect(squareName(chooseChess(t, 'medium', () => 0.5, 2000).to)).toBe('d5');
    expect(squareName(chooseChess(t, 'hard', () => 0.5, 2000).to)).toBe('d5');
  });
  it('Médio vence o Fácil e o Difícil vence o Médio com folga', () => {
    const a = chessDuel('medium', 'easy', 4);
    expect(a.score).toBeGreaterThanOrEqual(0.75);
    const b = chessDuel('hard', 'medium', 4);
    expect(b.score).toBeGreaterThanOrEqual(0.75);
  }, 600000);
});
