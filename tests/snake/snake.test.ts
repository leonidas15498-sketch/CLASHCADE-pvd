import { describe, expect, it } from 'vitest';
import { createSnakeGame, GRID, idx, step, turn, WIN_LEN, xy } from '../../src/games/snake/logic';
import { snakeDuel, snakeSolo } from '../bench/snake';

describe('cobrinha — regras', () => {
  it('anda, come a fruta e cresce 1', () => {
    const s = createSnakeGame(1, () => 0.5);
    const h = xy(s.snakes[0].body[0]);
    s.fruits = [idx(h.x + 1, h.y)];
    step(s);
    expect(s.snakes[0].body.length).toBe(4);
    expect(s.snakes[0].eaten).toBe(1);
    expect(s.fruits.length).toBe(1);
  });
  it('bate na parede = fim do solo', () => {
    const s = createSnakeGame(1, () => 0.5);
    s.fruits = [idx(0, 0)];
    let g = 0;
    while (s.result === null && g++ < 100) step(s);
    expect(s.result).toBe('over');
    expect(xy(s.snakes[0].body[0]).x).toBe(GRID.w - 1);
  });
  it('meia-volta é ignorada; pode entrar onde o rabo está saindo', () => {
    const s = createSnakeGame(1, () => 0.5);
    turn(s, 0, 3);
    expect(s.snakes[0].queue.length).toBe(0);
    // cobra de 4 em quadrado: a cabeça entra na célula do rabo, que sai no mesmo passo
    s.snakes[0].body = [idx(5, 5), idx(5, 6), idx(6, 6), idx(6, 5)];
    s.snakes[0].dir = 0;
    s.fruits = [idx(0, 0)];
    turn(s, 0, 1);
    step(s);
    expect(s.result).toBe(null);
  });
  it('duelo: batida de frente empata; chegar ao tamanho meta vence', () => {
    const s = createSnakeGame(2, () => 0.5);
    s.snakes[0].body = [idx(10, 5), idx(9, 5), idx(8, 5)];
    s.snakes[0].dir = 1;
    s.snakes[1].body = [idx(12, 5), idx(13, 5), idx(14, 5)];
    s.snakes[1].dir = 3;
    s.fruits = [idx(0, 0), idx(0, 1)];
    step(s);
    expect(s.result).toBe('draw');
    const w = createSnakeGame(2, () => 0.5);
    while (w.snakes[0].body.length < WIN_LEN - 1) w.snakes[0].body.push(w.snakes[0].body[w.snakes[0].body.length - 1]);
    const h = xy(w.snakes[0].body[0]);
    w.fruits = [idx(h.x + 1, h.y), idx(0, 0)];
    step(w);
    expect(w.result).toBe(0);
  });
});

describe('cobrinha — IA medida', () => {
  it('Difícil come mais sozinho que o Fácil; Médio e Difícil vencem quem está abaixo', () => {
    const easy = snakeSolo('easy');
    const hard = snakeSolo('hard');
    expect(hard).toBeGreaterThan(easy + 5);
    expect(snakeDuel('medium', 'easy').winA).toBeGreaterThanOrEqual(0.6);
    expect(snakeDuel('hard', 'medium').winA).toBeGreaterThanOrEqual(0.6);
  }, 60000);
});
