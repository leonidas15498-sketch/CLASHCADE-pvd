import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/games/pool/ai/ai';
import { floodArea, TrailsAI } from '../../src/games/trails/ai';
import { addRound, createRound, GRID, idx, stepRound, turn } from '../../src/games/trails/logic';
import { duel } from '../bench/trails';

describe('duelo de rastros — regras', () => {
  it('cada passo anda 1 célula e marca o rastro', () => {
    const s = createRound();
    const [a, b] = s.bikes;
    const ax = a.x;
    const bx = b.x;
    stepRound(s);
    expect(s.bikes[0].x).toBe(ax + 1);
    expect(s.bikes[1].x).toBe(bx - 1);
    expect(s.grid[idx(ax + 1, a.y)]).toBe(1);
    expect(s.grid[idx(bx - 1, b.y)]).toBe(2);
  });

  it('meia-volta é ignorada; curva vale no próximo passo', () => {
    const s = createRound();
    turn(s, 0, 3); // J1 vai para a direita: esquerda = meia-volta
    expect(s.bikes[0].queue).toEqual([]);
    turn(s, 0, 0);
    const y = s.bikes[0].y;
    stepRound(s);
    expect(s.bikes[0].y).toBe(y - 1);
  });

  it('duas curvas rápidas (U) entram na fila e são aplicadas em passos seguidos', () => {
    const s = createRound();
    turn(s, 0, 0);
    turn(s, 0, 3);
    const { x, y } = s.bikes[0];
    stepRound(s);
    stepRound(s);
    expect(s.bikes[0]).toMatchObject({ x: x - 1, y: y - 1, dir: 3 });
  });

  it('bater na parede perde a rodada', () => {
    const s = createRound();
    turn(s, 0, 0);
    for (let i = 0; i < GRID.h + 2 && s.result === null; i++) stepRound(s);
    expect(s.result).toBe(1);
    expect(s.crashes[0].p).toBe(0);
  });

  it('bater no rastro perde; encontro de frente empata', () => {
    const s = createRound();
    // coloca as motos frente a frente na mesma linha, a 2 células
    s.bikes[0].x = 10;
    s.bikes[0].y = 5;
    s.bikes[1].x = 12;
    s.bikes[1].y = 5;
    stepRound(s);
    expect(s.result).toBe('draw');
    const t = createRound();
    t.grid[idx(t.bikes[0].x + 1, t.bikes[0].y)] = 2;
    stepRound(t);
    expect(t.result).toBe(1);
  });

  it('partida: 3 rodadas vencem; empate não conta', () => {
    let m = { rounds: [0, 0] as [number, number], winner: null as 0 | 1 | null };
    m = addRound(m, 'draw');
    m = addRound(m, 0);
    m = addRound(m, 1);
    m = addRound(m, 0);
    expect(m.winner).toBeNull();
    m = addRound(m, 0);
    expect(m).toEqual({ rounds: [3, 1], winner: 0 });
  });

  it('inundação conta o espaço livre', () => {
    const s = createRound();
    expect(floodArea(s, 0, 0, 10_000)).toBe(GRID.w * GRID.h - 2);
  });
});

describe('duelo de rastros — IA', () => {
  it('Difícil nunca vira para uma parede tendo saída', () => {
    const s = createRound();
    const ai = new TrailsAI('hard', makeRng(1));
    s.bikes[1].x = 1;
    s.bikes[1].y = 10;
    s.bikes[1].dir = 3;
    ai.think(s);
    stepRound(s);
    expect(s.bikes[1].alive).toBe(true);
  });

  it('níveis: Médio vence Fácil e Difícil vence Médio na maioria das rodadas', () => {
    expect(duel('medium', 'easy', 40).winA).toBeGreaterThan(0.7);
    expect(duel('hard', 'medium', 40).winA).toBeGreaterThan(0.6);
  }, 120_000);
});

describe('rastros — trajeto cronológico (para o desenho)', () => {
  it('cada passo acrescenta exatamente a célula nova, vizinha da anterior; curva em U não liga trechos paralelos', async () => {
    const { createRound, stepRound, turn, GRID } = await import('../../src/games/trails/logic');
    const s = createRound();
    // J1 faz um U: direita, baixo, esquerda — fica paralelo ao próprio rastro
    stepRound(s);
    turn(s, 0, 2);
    stepRound(s);
    turn(s, 0, 3);
    for (let i = 0; i < 3; i++) stepRound(s);
    const path = s.paths[0];
    expect(path.length).toBe(1 + s.steps);
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs((path[i] % GRID.w) - (path[i - 1] % GRID.w));
      const dy = Math.abs(Math.floor(path[i] / GRID.w) - Math.floor(path[i - 1] / GRID.w));
      expect(dx + dy).toBe(1);
    }
    // a célula inicial e a última do trecho de volta são vizinhas na grade, mas NÃO consecutivas no trajeto
    expect(path.indexOf(path[0])).toBe(0);
    expect(new Set(path).size).toBe(path.length);
  });
});
