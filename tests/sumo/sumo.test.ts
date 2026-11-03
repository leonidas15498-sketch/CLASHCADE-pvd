import { describe, expect, it } from 'vitest';
import { createSumo, dash, ringRadius, setInput, stepSumo, SUMO } from '../../src/games/sumo/logic';
import { sumoDuel } from '../bench/sumo';

const run = (s: ReturnType<typeof createSumo>, secs: number) => {
  for (let i = 0; i < secs / SUMO.dt; i++) stepSumo(s);
};

describe('sumô neon — física e regras', () => {
  it('joystick acelera até a velocidade de cruzeiro (acc/drag) e respeita |v| ≤ 1', () => {
    const s = createSumo();
    run(s, SUMO.freeze + 0.01);
    setInput(s, 0, 0, 5); // vetor grande é limitado a 1
    expect(Math.hypot(s.w[0].ix, s.w[0].iy)).toBeCloseTo(1, 6);
    run(s, 0.4);
    const v = Math.hypot(s.w[0].vx, s.w[0].vy);
    expect(v).toBeGreaterThan(0.9);
    expect(v).toBeLessThanOrEqual(SUMO.acc / SUMO.drag + 1e-6);
  });

  it('avanço tem recarga e não funciona na contagem', () => {
    const s = createSumo();
    expect(dash(s, 0)).toBe(false); // ainda na contagem
    run(s, SUMO.freeze + 0.01);
    expect(dash(s, 0)).toBe(true);
    expect(dash(s, 0)).toBe(false);
    run(s, SUMO.dashCd + 0.02);
    expect(dash(s, 0)).toBe(true);
  });

  it('choque conserva o momento (massas iguais) e não deixa um atravessar o outro', () => {
    const s = createSumo();
    run(s, SUMO.freeze + 0.01);
    s.w[0].x = -0.2;
    s.w[1].x = 0.2;
    s.w[0].vx = 2;
    s.w[1].vx = 0;
    let minD = 9;
    let maxV1 = 0;
    for (let i = 0; i < 60; i++) {
      const p0 = s.w[0].vx + s.w[1].vx;
      stepSumo(s);
      // no passo do choque a soma das velocidades só cai pelo arrasto (momento conservado no impacto)
      expect(s.w[0].vx + s.w[1].vx).toBeLessThanOrEqual(p0 + 1e-9);
      minD = Math.min(minD, Math.hypot(s.w[1].x - s.w[0].x, s.w[1].y - s.w[0].y));
      maxV1 = Math.max(maxV1, s.w[1].vx);
    }
    expect(minD).toBeGreaterThan(2 * SUMO.bodyR - 0.02);
    expect(maxV1).toBeGreaterThan(1.2); // o empurrado saiu andando
  });

  it('sair do ringue dá o round ao outro; 2 rounds vencem a partida', () => {
    const s = createSumo();
    run(s, SUMO.freeze + 0.01);
    s.w[1].x = 0.99;
    s.w[1].vx = 1;
    run(s, 0.1);
    expect(s.wins).toEqual([1, 0]);
    run(s, 1.2 + SUMO.freeze); // intervalo + contagem do round 2
    expect(s.round).toBe(2);
    s.w[1].x = -0.99;
    s.w[1].vx = -1;
    run(s, 0.1);
    expect(s.winner).toBe(0);
  });

  it('os dois saindo juntos anulam o round (ninguém pontua)', () => {
    const s = createSumo();
    run(s, SUMO.freeze + 0.01);
    s.w[0].x = -0.995;
    s.w[0].vx = -1;
    s.w[1].x = 0.995;
    s.w[1].vx = 1;
    run(s, 0.05);
    expect(s.wins).toEqual([0, 0]);
    expect(s.events.some((e) => e.type === 'out' && e.loser === 'both')).toBe(true);
  });

  it('ringue encolhe depois de 10 s e o tempo decide quem está mais perto do centro', () => {
    expect(ringRadius(5)).toBe(1);
    expect(ringRadius(15)).toBeCloseTo(0.8, 6);
    expect(ringRadius(25)).toBeCloseTo(SUMO.minRing, 6);
    const s = createSumo();
    run(s, SUMO.freeze + 0.01);
    s.w[0].x = -0.1;
    s.w[1].x = 0.4;
    run(s, SUMO.roundTime + 0.05);
    expect(s.wins[0]).toBe(1);
  });

  it('IA: Fácil < Médio < Difícil com folga (IA × IA, melhor de 3)', () => {
    expect(sumoDuel('medium', 'easy', 30).win).toBeGreaterThan(0.7);
    expect(sumoDuel('hard', 'medium', 30).win).toBeGreaterThan(0.58);
  }, 60_000);
});
