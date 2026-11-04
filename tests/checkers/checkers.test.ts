import { describe, expect, it } from 'vitest';
import { applyMove, Cell, CheckersState, count, createCheckers, idx, legalMoves } from '../../src/games/checkers/logic';
import { checkersDuel } from '../bench/checkers';

/** Monta um tabuleiro vazio com as peças dadas: [linha, coluna, valor]. */
function setup(pieces: Array<[number, number, Cell]>, current: 0 | 1 = 0): CheckersState {
  const s = createCheckers();
  s.board.fill(0);
  for (const [r, c, v] of pieces) s.board[idx(r, c)] = v;
  s.current = current;
  return s;
}

describe('damas — regras brasileiras', () => {
  it('início: 12 peças cada, 7 lances de abertura para o Jogador 1', () => {
    const s = createCheckers();
    expect(count(s, 0)).toEqual({ men: 12, kings: 0 });
    expect(count(s, 1)).toEqual({ men: 12, kings: 0 });
    expect(legalMoves(s).length).toBe(7);
  });
  it('captura é obrigatória e a pedra captura para trás', () => {
    const s = setup([[4, 3, 1], [5, 4, -1], [0, 1, -1]]);
    const m = legalMoves(s);
    expect(m.length).toBe(1);
    expect(m[0].captured).toEqual([idx(5, 4)]);
    expect(m[0].path).toEqual([idx(4, 3), idx(6, 5)]);
  });
  it('lei da maioria: obriga a sequência que toma mais peças', () => {
    // pedra em (5,0): pode tomar 1 para um lado ou 2 em sequência para o outro
    const s = setup([[5, 2, 1], [4, 1, -1], [4, 3, -1], [2, 3, -1], [0, 7, -1]]);
    const m = legalMoves(s);
    expect(m.every((x) => x.captured.length === 2)).toBe(true);
    applyMove(s, m[0]);
    expect(count(s, 1).men).toBe(2);
  });
  it('dama voadora anda e captura de longe', () => {
    const s = setup([[7, 0, 2], [3, 4, -1], [0, 1, -1]]);
    const m = legalMoves(s);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.captured.length === 1)).toBe(true);
    // pode parar em (2,5), (1,6) ou (0,7) depois da peça
    expect(m.map((x) => x.path[x.path.length - 1]).sort()).toEqual([idx(0, 7), idx(1, 6), idx(2, 5)].sort());
  });
  it('vira dama só ao terminar na última linha', () => {
    const s = setup([[1, 2, 1], [7, 0, -1]]);
    const m = legalMoves(s).find((x) => x.path[1] === idx(0, 1))!;
    applyMove(s, m);
    expect(s.board[idx(0, 1)]).toBe(2);
  });
  it('quem fica sem lance perde', () => {
    const s = setup([[2, 3, 1], [1, 2, -1]], 0);
    // J1 toma a última peça do J2 → J2 sem lance
    const m = legalMoves(s);
    expect(m.length).toBe(1);
    applyMove(s, m[0]);
    expect(s.winner).toBe(0);
  });
  it('IA: Fácil < Médio < Difícil', () => {
    const mVsE = checkersDuel('medium', 'easy', 8);
    const hVsM = checkersDuel('hard', 'medium', 6);
    expect(mVsE.winA).toBeGreaterThan(0.6);
    expect(hVsM.winA + hVsM.draws * 0.5).toBeGreaterThan(0.55);
  }, 120000);
});
