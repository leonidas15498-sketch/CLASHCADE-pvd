import { describe, expect, it } from 'vitest';
import { chooseC4, evaluate } from '../../src/games/connect4/ai';
import { canPlay, COLS, createC4, play, ROWS, undo } from '../../src/games/connect4/logic';
import { makeRng } from '../../src/games/pool/ai/ai';
import { c4Duel } from '../bench/connect4';

const seq = (moves: number[], first: 0 | 1 = 0) => {
  const s = createC4(first);
  for (const c of moves) play(s, c);
  return s;
};

describe('lig-4 — regras', () => {
  it('peça cai até a posição livre mais baixa e a vez alterna', () => {
    const s = seq([3, 3]);
    expect(s.cells[3][0]).toBe(1);
    expect(s.cells[3][1]).toBe(2);
    expect(s.current).toBe(0);
  });
  it('4 na horizontal, vertical e nas duas diagonais vencem', () => {
    expect(seq([0, 0, 1, 1, 2, 2, 3]).winner).toBe(0);
    expect(seq([0, 1, 0, 1, 0, 1, 0]).winner).toBe(0);
    // diagonal subindo
    expect(seq([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]).winner).toBe(0);
    // diagonal descendo
    expect(seq([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]).winner).toBe(0);
  });
  it('linha vencedora marcada; jogada após o fim e coluna cheia são recusadas', () => {
    const s = seq([0, 0, 1, 1, 2, 2, 3]);
    expect(s.line.length).toBeGreaterThanOrEqual(4);
    expect(play(s, 5)).toBe(-1);
    const t = seq([0, 0, 0, 0, 0, 0]);
    expect(canPlay(t, 0)).toBe(false);
  });
  it('grade cheia sem 4 = empate', () => {
    // padrão sem 4 em linha: colunas em blocos que alternam
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const s = createC4(0);
    for (const c of order) play(s, c);
    expect(s.moves.length).toBe(COLS * ROWS);
    expect(s.winner).toBe('draw');
  });
  it('desfazer volta ao estado anterior', () => {
    const s = seq([3, 4, 3]);
    undo(s);
    expect(s.cells[3][1]).toBe(0);
    expect(s.current).toBe(0);
  });
});

describe('lig-4 — IA', () => {
  it('Médio e Difícil ganham na hora quando podem', () => {
    const t = seq([0, 6, 0, 6, 0, 5]); // J1 ganha na coluna 0
    expect(chooseC4(t, 'medium', makeRng(1))).toBe(0);
    expect(chooseC4(t, 'hard', makeRng(1))).toBe(0);
  });
  it('Médio e Difícil bloqueiam a vitória imediata do rival', () => {
    const s = seq([0, 6, 1, 6, 2]); // vez do J2; J1 ameaça a coluna 3
    expect(chooseC4(s, 'medium', makeRng(2))).toBe(3);
    expect(chooseC4(s, 'hard', makeRng(2))).toBe(3);
  });
  it('avaliação: ter 3 abertas vale mais para quem as tem', () => {
    const s = seq([0, 6, 1, 6, 2]);
    expect(evaluate(s, 0)).toBeGreaterThan(evaluate(s, 1));
  });
  it('níveis: Fácil > aleatório, Médio > Fácil, Difícil > Médio, com folga', () => {
    expect(c4Duel('easy', 'random', 20).score).toBeGreaterThan(0.75);
    expect(c4Duel('medium', 'easy', 20).score).toBeGreaterThan(0.75);
    expect(c4Duel('hard', 'medium', 10).score).toBeGreaterThan(0.6);
  }, 180_000);
});
