import { describe, expect, it } from 'vitest';
import { blocksAiScore } from '../bench/blocks-ai';
import {
  BOARD_CLEAR_BONUS,
  canPlace,
  clearPoints,
  comboMult,
  createBlocks,
  fitsAnywhere,
  hasMove,
  N,
  place,
  refill,
  shapeById,
  SHAPES,
  tierOf,
  nextTier,
} from '../../src/games/blocks/logic';
import { benchBlocks } from '../bench/blocks';

/** Estado com grade e bandeja definidas ('#' = cheio). */
function setup(rows: string[], tray: string[]) {
  const s = createBlocks(1);
  s.grid.fill(0);
  rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && (s.grid[r * N + c] = 1)));
  s.tray = tray.map((id, i) => ({ shape: shapeById(id)!, color: 2, uid: 100 + i }));
  return s;
}

describe('blocos — peças', () => {
  it('rotações distintas, ids únicos e todas cabem na grade vazia', () => {
    const ids = SHAPES.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SHAPES.filter((x) => x.id.startsWith('o2')).length).toBe(1);
    expect(SHAPES.filter((x) => x.id.startsWith('s4')).length).toBe(2);
    expect(SHAPES.filter((x) => x.id.startsWith('l4')).length).toBe(4);
    for (const sh of SHAPES) expect(fitsAnywhere(new Uint8Array(N * N), sh)).toBe(true);
  });
});

describe('blocos — encaixe e limpeza', () => {
  it('recusa fora da grade e sobre peça; jogada inválida não muda nada', () => {
    const s = setup(['#'], ['o2', 'p1', 'p1']);
    expect(canPlace(s.grid, shapeById('o2')!, 0, 0)).toBe(false);
    expect(canPlace(s.grid, shapeById('o2')!, 7, 0)).toBe(false);
    expect(place(s, 0, 0, 7)).toBeNull();
    expect(s.score).toBe(0);
    expect(s.tray[0]).not.toBeNull();
  });
  it('linha completa some e pontua 10 + quadradinhos', () => {
    const s = setup(['#####...'], ['i30', 'p1', 'p1']);
    const r = place(s, 0, 0, 5)!;
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([]);
    expect(r.placePts).toBe(3);
    expect(r.clearPts).toBe(10);
    expect(s.grid.slice(0, 8).every((v) => v === 0)).toBe(true);
  });
  it('linha + coluna na mesma jogada = 2 linhas (30); cruzamento conta uma vez', () => {
    const rows = ['.#######', ...Array(7).fill('#.......')];
    rows[0] = '.#######';
    const s = setup(rows.map((r, i) => (i === 0 ? r : r)), ['p1', 'p1', 'p1']);
    // coluna 0 tem linhas 1..7 cheias; linha 0 tem colunas 1..7 cheias → falta (0,0)
    const r = place(s, 0, 0, 0)!;
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([0]);
    expect(r.clearPts).toBe(clearPoints(2));
    expect(r.clearedCells.length).toBe(15);
  });
  it('pontos por linhas simultâneas crescem: 10, 30, 60, 100', () => {
    expect([1, 2, 3, 4].map(clearPoints)).toEqual([10, 30, 60, 100]);
  });
  it('grade vazia depois de limpar dá bônus', () => {
    const s = setup(['#######.'], ['p1', 'p1', 'p1']);
    const r = place(s, 0, 0, 7)!;
    expect(r.boardClear).toBe(true);
    expect(r.total).toBe(1 + 10 + BOARD_CLEAR_BONUS);
  });
});

describe('blocos — combo', () => {
  it('multiplicador 1, 1,5, 2… até 5', () => {
    expect([1, 2, 3, 9, 20].map(comboMult)).toEqual([1, 1.5, 2, 5, 5]);
  });
  it('sequência aumenta a cada limpeza e só zera após 3 jogadas sem limpar', () => {
    const s = setup(['#######.', '#######.', '........', '........'], ['p1', 'p1', 'p1']);
    place(s, 0, 0, 7); // limpa linha 0 → combo 1
    expect(s.streak).toBe(1);
    const r2 = place(s, 1, 1, 7)!; // limpa linha 1 → combo 2 (×1,5)
    expect(r2.mult).toBe(1.5);
    expect(r2.clearPts).toBe(15);
    // nova bandeja de 1x1 para testar a tolerância
    s.tray = [0, 1, 2].map((i) => ({ shape: shapeById('p1')!, color: 1, uid: 900 + i }));
    place(s, 0, 5, 0);
    place(s, 1, 5, 2);
    expect(s.streak).toBe(2);
    place(s, 2, 5, 4); // 3ª sem limpar
    expect(s.streak).toBe(0);
  });
});

describe('blocos — bandeja e fim', () => {
  it('usar as 3 peças traz 3 novas', () => {
    const s = setup([], ['p1', 'p1', 'p1']);
    place(s, 0, 0, 0);
    place(s, 1, 0, 2);
    expect(s.tray.filter(Boolean).length).toBe(1);
    place(s, 2, 0, 4);
    expect(s.tray.filter(Boolean).length).toBe(3);
  });
  it('refill garante pelo menos uma peça que cabe (quando alguma pode caber)', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = createBlocks(seed);
      // grade quase cheia com 1 buraco: só o 1×1 cabe
      s.grid.fill(1);
      s.grid[27] = 0;
      refill(s);
      expect(hasMove(s)).toBe(true);
    }
  });
  it('acaba quando nenhuma peça da bandeja cabe', () => {
    // xadrez: nenhuma linha cheia e nenhuma dupla de casas vazias vizinhas → só o 1×1 cabe
    const board = Array.from({ length: 8 }, (_, r) => (r % 2 ? '.#.#.#.#' : '#.#.#.#.'));
    const s = setup(board, ['p1', 'i20', 'o2']);
    expect(hasMove(s)).toBe(true);
    place(s, 0, 0, 1);
    expect(s.over).toBe(true);
    expect(place(s, 1, 0, 3)).toBeNull();
  });
  it('mesma semente = mesma sequência de peças (para reproduzir problemas)', () => {
    const a = createBlocks(42).tray.map((p) => p!.shape.id);
    const b = createBlocks(42).tray.map((p) => p!.shape.id);
    expect(a).toEqual(b);
  });
});

describe('blocos — faixas', () => {
  it('faixa atual e próxima', () => {
    expect(tierOf(0)).toBeNull();
    expect(tierOf(300)!.name).toBe('Bronze');
    expect(tierOf(2600)!.name).toBe('Ouro');
    expect(nextTier(2600)!.name).toBe('Diamante');
    expect(nextTier(99999)).toBeNull();
  });
  it('robô atento pontua bem mais que o aleatório (pontuação recompensa jogar bem)', () => {
    const rnd = benchBlocks('random', 30);
    const gr = benchBlocks('greedy', 8);
    expect(gr.median).toBeGreaterThan(rnd.median * 3);
  });
});

describe('blocos — IA medida (pontos até acabar o espaço, mesmas sementes)', () => {
  it('Fácil < Médio < Difícil com folga', () => {
    const avg = (d: 'easy' | 'medium' | 'hard') => [1007, 2007, 3007, 4007].reduce((a, s) => a + blocksAiScore(d, s, 200).score, 0) / 4;
    const e = avg('easy');
    const m = avg('medium');
    const h = avg('hard');
    expect(m).toBeGreaterThan(e * 1.4);
    expect(h).toBeGreaterThan(m * 1.4);
  }, 300000);
});
