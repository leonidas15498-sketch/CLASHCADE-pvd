import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { aimRay, createWorld, moverSegments, pointInPoly, simulateShot, step, strike } from '../../src/games/minigolf/physics/sim';
import { GOLF, Level } from '../../src/games/minigolf/physics/types';

const box: Level = {
  ...LEVELS[0],
  walls: LEVELS[0].walls,
  bumpers: [],
  movers: [],
  zones: [],
};
const R = GOLF.ballR;

describe('minigolfe — física', () => {
  it('bola desacelera, para de vez e não acelera sozinha', () => {
    const w = createWorld(box, { x: 10, y: 15 });
    strike(w, 0, 0.3);
    let last = Infinity;
    while (w.status === 'moving') {
      step(w);
      const s = Math.hypot(w.vx, w.vy);
      expect(s).toBeLessThanOrEqual(last + 1e-9);
      last = s;
    }
    expect(w.status === 'rest' || w.status === 'holed').toBe(true);
    const x = w.x;
    for (let i = 0; i < 60; i++) step(w);
    expect(w.x).toBe(x);
  });

  it('não permite nova tacada com a bola em movimento', () => {
    const w = createWorld(box, { x: 10, y: 15 });
    expect(strike(w, 0, 0.5)).toBe(true);
    step(w);
    expect(strike(w, Math.PI, 1)).toBe(false);
  });

  it('rebate na parede em vários ângulos, com perda de energia, sem atravessar', () => {
    for (const deg of [-90, -60, -30, -10, 10, 45, 80, 90]) {
      const w = createWorld(box, { x: 30, y: 15 });
      strike(w, (deg * Math.PI) / 180, 1);
      let hit = false;
      while (w.status === 'moving') {
        step(w);
        expect(w.y).toBeGreaterThanOrEqual(9 + R - 1e-6);
        expect(w.y).toBeLessThanOrEqual(21 - R + 1e-6);
        expect(w.x).toBeGreaterThanOrEqual(5 + R - 1e-6);
        expect(w.x).toBeLessThanOrEqual(55 - R + 1e-6);
        if (!hit && w.events.some((e) => e.type === 'wall')) hit = true;
      }
      expect(hit).toBe(true);
    }
  });

  it('velocidade máxima no canto não atravessa nem trava', () => {
    const w = createWorld(box, { x: 50, y: 18 });
    strike(w, Math.atan2(3, 5), 1); // direto no canto inferior direito
    let n = 0;
    while (w.status === 'moving' && n++ < 20000) step(w);
    expect(w.status === 'rest' || w.status === 'holed').toBe(true);
    expect(pointInPoly(w, box.green)).toBe(true);
  });

  it('cai no buraco devagar; rápido demais passa por cima', () => {
    const lv = LEVELS[0];
    const slow = simulateShot(lv, { x: 41, y: 15 }, 0, 0, 0.32);
    expect(slow.status).toBe('holed');
    const fast = createWorld(lv, { x: 41, y: 15 });
    strike(fast, 0, 1);
    let passed = false;
    while (fast.status === 'moving') {
      step(fast);
      if (fast.x > lv.hole.x + GOLF.holeR) passed = true;
    }
    expect(passed).toBe(true);
  });

  it('bola parada fora do buraco não é sugada de longe', () => {
    const lv = LEVELS[0];
    const r = simulateShot(lv, { x: 30, y: 15 }, 0, 0, 0.18);
    expect(r.status).toBe('rest');
    expect(Math.hypot(r.x - lv.hole.x, r.y - lv.hole.y)).toBeGreaterThan(GOLF.holeR);
  });

  it('cair na água conta como fora de campo', () => {
    const lv = LEVELS[4];
    const r = simulateShot(lv, lv.tee, 0, Math.atan2(-8, 12), 0.6);
    expect(r.status).toBe('out');
  });

  it('rampa: bola fraca volta; forte passa', () => {
    const lv = LEVELS[3];
    // fraca: chega na rampa sem força, sobe um pouco e volta
    const w = createWorld(lv, lv.tee);
    strike(w, 0, 0.52);
    let maxX = 0;
    while (w.status === 'moving') {
      step(w);
      maxX = Math.max(maxX, w.x);
    }
    expect(maxX).toBeGreaterThan(24);
    expect(w.x).toBeLessThan(24);
    const strong = simulateShot(lv, lv.tee, 0, 0, 0.75);
    expect(strong.x).toBeGreaterThan(32);
  });

  it('obstáculo móvel empurra a bola (velocidade do ponto de contato)', () => {
    const lv = LEVELS[5];
    const m = lv.movers[0];
    const segs = moverSegments(m, 0);
    expect(segs.length).toBe(4);
    const v = segs[0].vel({ x: 31 + 5, y: 15 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1.1 * 5, 6);
  });

  it('a linha de mira para no primeiro obstáculo, igual à colisão', () => {
    const lv = LEVELS[2];
    const ray = aimRay(lv, lv.tee, 0, 0, 100);
    expect(ray.hit).toBe(true);
    expect(ray.end.x).toBeCloseTo(27 - R, 6);
    // a bola de verdade toca o bloco nesse mesmo ponto
    const w = createWorld(lv, lv.tee);
    strike(w, 0, 0.6);
    while (w.status === 'moving' && !w.events.some((e) => e.type === 'wall')) step(w);
    expect(Math.abs(w.x - ray.end.x)).toBeLessThan(0.05);
  });

  it('determinismo: mesma tacada, mesmo instante, mesmo resultado', () => {
    const lv = LEVELS[5];
    const a = simulateShot(lv, lv.tee, 1.234, 0.05, 0.7);
    const b = simulateShot(lv, lv.tee, 1.234, 0.05, 0.7);
    expect(a).toEqual(b);
  });
});

describe('minigolfe — captura no buraco (01/11)', () => {
  const H = LEVELS[0].hole;
  const run = (offset: number, speed: number) => {
    // bola entra no buraco na horizontal, passando a `offset` (fração do raio) do centro
    const w = createWorld({ ...box, hole: H }, { x: H.x - GOLF.holeR - 0.05, y: H.y + offset * GOLF.holeR });
    w.vx = speed;
    w.vy = 0;
    w.status = 'moving';
    for (let i = 0; i < 240 && w.status === 'moving'; i++) step(w);
    return w;
  };
  it('pelo centro, devagar cai e rápido demais passa com evento lip', () => {
    expect(run(0, 8).status).toBe('holed');
    const fast = run(0, 26);
    expect(fast.status).not.toBe('holed');
    expect(fast.events.some((e) => e.type === 'lip')).toBe(true);
  });
  it('perto da borda, velocidade moderada (6,5 u/s) agora cai', () => {
    expect(run(0.92, 6.5).status).toBe('holed');
  });
});

describe('minigolfe — evento lip só quando a bola sai sem cair', () => {
  it('bola que cai não gera lip', () => {
    const H = LEVELS[0].hole;
    const w = createWorld(box, { x: H.x - GOLF.holeR - 0.05, y: H.y + 0.5 * GOLF.holeR });
    w.vx = 6;
    w.status = 'moving';
    for (let i = 0; i < 240 && w.status === 'moving'; i++) step(w);
    expect(w.status).toBe('holed');
    expect(w.events.some((e) => e.type === 'lip')).toBe(false);
  });
});
