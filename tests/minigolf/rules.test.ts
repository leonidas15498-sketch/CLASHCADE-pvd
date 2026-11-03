import { describe, expect, it } from 'vitest';
import { advance, applyShot, createMatch, holeComplete, MAX_STROKES, result } from '../../src/games/minigolf/rules/rules';

const tee = { x: 1, y: 1 };
const nine = [0, 1, 2, 3, 4, 5, 6, 7, 8];

describe('minigolfe — regras', () => {
  it('cada tacada conta uma vez; parar atualiza o ponto seguro', () => {
    let m = createMatch('solo', ['Ana'], nine, tee);
    m = applyShot(m, { kind: 'rest', pos: { x: 5, y: 5 } });
    expect(m.ph[0].strokes).toBe(1);
    expect(m.ph[0].safe).toEqual({ x: 5, y: 5 });
    m = applyShot(m, { kind: 'holed' });
    expect(m.players[0].scores[0]).toBe(2);
    expect(holeComplete(m)).toBe(true);
  });

  it('fora de campo: volta ao último ponto seguro com +1 de penalidade', () => {
    let m = createMatch('solo', ['Ana'], nine, tee);
    m = applyShot(m, { kind: 'rest', pos: { x: 5, y: 5 } });
    m = applyShot(m, { kind: 'out' });
    expect(m.ph[0].strokes).toBe(3);
    expect(m.ph[0].pos).toEqual({ x: 5, y: 5 });
    expect(m.lastMessage).toMatch(/penalidade/);
  });

  it('limite de 10 tacadas encerra o buraco com 10 (penalidade não passa do teto)', () => {
    let m = createMatch('solo', ['Ana'], nine, tee);
    for (let i = 0; i < 9; i++) m = applyShot(m, { kind: 'rest', pos: tee });
    expect(m.ph[0].done).toBe(false);
    m = applyShot(m, { kind: 'out' }); // 10 + 1 → teto 10
    expect(m.ph[0].done).toBe(true);
    expect(m.players[0].scores[0]).toBe(MAX_STROKES);
  });

  it('2P: alterna tacadas, pula quem terminou, avança só quando os dois terminam', () => {
    let m = createMatch('duo', ['Ana', 'Beto'], nine, tee);
    expect(m.current).toBe(0);
    m = applyShot(m, { kind: 'rest', pos: { x: 2, y: 2 } });
    expect(m.current).toBe(1);
    m = applyShot(m, { kind: 'holed' });
    expect(m.current).toBe(0);
    expect(holeComplete(m)).toBe(false);
    m = applyShot(m, { kind: 'rest', pos: { x: 3, y: 3 } });
    expect(m.current).toBe(0); // Beto já terminou
    m = applyShot(m, { kind: 'holed' });
    expect(holeComplete(m)).toBe(true);
    expect(m.players.map((p) => p.scores[0])).toEqual([3, 1]);
    m = advance(m, tee);
    expect(m.holeIdx).toBe(1);
    expect(m.ph.every((p) => p.strokes === 0 && !p.done)).toBe(true);
  });

  const play = (a: number[], b: number[]) => {
    let m = createMatch('duo', ['Ana', 'Beto'], nine, tee);
    m = { ...m, players: [{ name: 'Ana', scores: a }, { name: 'Beto', scores: b }] };
    return result(m);
  };

  it('menor total vence', () => {
    expect(play([2, 2, 2, 2, 2, 2, 2, 2, 2], [3, 2, 2, 2, 2, 2, 2, 2, 2])).toMatchObject({ winner: 0, reason: 'total' });
  });
  it('empate no total: desempata pelos 3 últimos buracos', () => {
    expect(play([2, 2, 2, 2, 2, 2, 3, 2, 2], [3, 2, 2, 2, 2, 2, 2, 2, 2])).toMatchObject({ winner: 1, reason: 'last3' });
  });
  it('persistindo o empate, declara empate', () => {
    expect(play([2, 2, 2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2, 2, 2])).toMatchObject({ winner: null, reason: 'draw' });
  });
  it('fim da partida após o 9º buraco', () => {
    let m = createMatch('solo', ['Ana'], nine, tee);
    for (let h = 0; h < 9; h++) {
      m = applyShot(m, { kind: 'holed' });
      m = advance(m, h < 8 ? tee : null);
    }
    expect(m.finished).toBe(true);
    expect(result(m).totals[0]).toBe(9);
  });
});
