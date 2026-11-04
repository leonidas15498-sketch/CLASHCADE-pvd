import { describe, expect, it } from 'vitest';
import { cellOf, createLudo, FINISH, moveToken, movable, roll, SAFE, SEATS, TRACK, trackIndex } from '../../src/games/ludo/logic';
import { ludoDuel } from '../bench/ludo';

describe('ludo — regras', () => {
  it('trilha: 52 casas vizinhas (4 passos na diagonal nas quinas), sem repetir, e corredores entram pela casa certa', () => {
    expect(TRACK.length).toBe(52);
    expect(new Set(TRACK.map((x) => x.join())).size).toBe(52);
    for (let i = 0; i < 52; i++) {
      const [a, b] = TRACK[i];
      const [c, d] = TRACK[(i + 1) % 52];
      // vizinha de lado, ou na diagonal nas 4 quinas internas da cruz (como no tabuleiro de verdade)
      expect(Math.max(Math.abs(a - c), Math.abs(b - d)), `casa ${i}`).toBe(1);
    }
    for (const seat of SEATS) {
      // última casa da trilha (posição 50) é vizinha da 1ª do corredor
      const [a, b] = TRACK[(seat.start + 50) % 52];
      const [c, d] = seat.home[0];
      expect(Math.abs(a - c) + Math.abs(b - d)).toBe(1);
    }
  });
  it('só sai da base com 6, e o 6 dá outra jogada', () => {
    const s = createLudo(2, 0);
    expect(roll(s, 3)).toBe('pass');
    expect(s.current).toBe(1);
    s.current = 0;
    expect(roll(s, 6)).toBe('choose');
    expect(movable(s)).toEqual([0, 1, 2, 3]);
    const r = moveToken(s, 0);
    expect(r.again).toBe(true);
    expect(s.current).toBe(0);
    expect(cellOf(s, 0, 0)).toEqual(TRACK[SEATS[0].start]);
  });
  it('captura manda o rival para a base e dá outra jogada; casa segura protege', () => {
    const s = createLudo(2, 0);
    // rival numa casa comum 3 casas à frente do meu peão
    s.pos[0][0] = 4;
    const target = trackIndex(s, 0, 7);
    expect(SAFE.has(target)).toBe(false);
    s.pos[1][0] = (target - SEATS[1].start + 52) % 52;
    expect(trackIndex(s, 1, s.pos[1][0])).toBe(target);
    roll(s, 3);
    const r = moveToken(s, 0);
    expect(r.captured).toEqual([{ player: 1, token: 0 }]);
    expect(s.pos[1][0]).toBe(-1);
    expect(r.again).toBe(true);
    // na casa segura (estrela), não captura
    const t = createLudo(2, 0);
    t.pos[0][0] = 4;
    const star = trackIndex(t, 0, 8);
    expect(SAFE.has(star)).toBe(true);
    t.pos[1][0] = (star - SEATS[1].start + 52) % 52;
    roll(t, 4);
    expect(moveToken(t, 0).captured).toEqual([]);
  });
  it('precisa do número exato para chegar; 4 no centro vence', () => {
    const s = createLudo(2, 0);
    s.pos[0] = [FINISH, FINISH, FINISH, FINISH - 2];
    expect(roll(s, 5)).toBe('pass');
    s.current = 0;
    roll(s, 2);
    moveToken(s, 3);
    expect(s.winner).toBe(0);
  });
  it('três 6 seguidos perdem a vez', () => {
    const s = createLudo(2, 0);
    roll(s, 6);
    moveToken(s, 0);
    roll(s, 6);
    moveToken(s, 0);
    expect(roll(s, 6)).toBe('forfeit');
    expect(s.current).toBe(1);
  });
  it('IA: Fácil < Médio < Difícil (Ludo tem muita sorte; medido em 400 partidas)', () => {
    expect(ludoDuel('medium', 'easy').winA).toBeGreaterThan(0.58);
    expect(ludoDuel('hard', 'medium').winA).toBeGreaterThan(0.53);
  }, 60000);
});
