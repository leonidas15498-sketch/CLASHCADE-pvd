import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRound, stepRound, turn } from '../../src/games/trails/logic';
import { StackMatch } from '../../src/games/stack/logic';
import { createPong, PONG, PongState } from '../../src/games/pong/physics';
import { PongGame } from '../../src/games/pong';
import { createWorld, step } from '../../src/games/minigolf/physics/sim';
import { LEVELS } from '../../src/games/minigolf/levels/levels';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('V13 confirmed gameplay regressions', () => {
  it('applies out-of-field rules after a moving obstacle correction', () => {
    const level = { ...LEVELS[0], walls: [], zones: [], bumpers: [],
      green: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}], hole: {x:9,y:9},
      movers: [{ kind: 'rotor' as const, center: {x:2,y:5}, length:3, r:0.2, arms:1, speed:0, phase:0 }] };
    const w = createWorld(level, {x:1,y:5}); w.status = 'moving'; w.vx = 0.01;
    step(w);
    expect(w.status).toBe('out'); expect(w.events.some(e => e.type === 'out')).toBe(true);
  });
  it('does not discard a queued corner and accidentally reverse into its own trail', () => {
    const s = createRound();
    turn(s, 0, 0); turn(s, 0, 3); turn(s, 0, 2);
    stepRound(s);
    expect(s.bikes[0].dir).toBe(0);
    expect(s.bikes[0].alive).toBe(true);
    stepRound(s);
    expect(s.bikes[0].dir).toBe(3);
    expect(s.bikes[0].alive).toBe(true);
  });

  it('keeps the current player responsible for an unstable tower after seven seconds', () => {
    const m = new StackMatch(2, () => 0.5);
    m.drop(0, 0);
    vi.spyOn(m.sw, 'motion').mockReturnValue(1);
    for (let i = 0; i < 480; i++) m.tick();
    expect(m.settleT).toBeGreaterThan(7);
    expect(m.phase).toBe('settle'); expect(m.current).toBe(0); expect(m.placed).toBe(0);
    vi.restoreAllMocks();
    for (let i = 0; i < 240 && m.phase === 'settle'; i++) m.tick();
    expect(m.phase).toBe('aim'); expect(m.current).toBe(1);
  });

  it('advances real Pong keyboard input identically at 30, 60 and 120 render FPS', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const simulate = (fps: number) => {
      const s = createPong(0, () => 0.5);
      // Exercise the actual frame/keyMove code without a rendering surface.
      const game = Object.assign(Object.create(PongGame.prototype), {
        s, cfg: { mode: 'local' }, keys: new Set(['s']), ai: null,
        shell: { paused: false, sfx: { frame() {} } },
        last: 1000, acc: 0, disposed: false, flash: 0,
        trail: [], fx: { update() {} }, handleEvents() {}, draw() {},
      }) as { frame(t: number): void; s: PongState };
      for (let frame = 1; frame <= fps; frame++) game.frame(1000 + frame * 1000 / fps);
      game.frame(2000 + PONG.dt * 1000 * 0.01);
      return { paddle: s.paddles[0].y, target: s.paddles[0].ty, time: s.t };
    };
    const reference = simulate(120);
    for (const fps of [30, 60]) {
      const result = simulate(fps);
      expect(result.paddle).toBeCloseTo(reference.paddle, 8);
      expect(result.target).toBeCloseTo(reference.target, 8);
      expect(result.time).toBeCloseTo(reference.time, 8);
    }
  });
});
