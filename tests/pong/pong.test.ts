import { describe, expect, it } from 'vitest';
import { PongAI } from '../../src/games/pong/ai';
import { clampPaddleY, createPong, paddleX, PONG, setPaddle, stepPong, TABLE } from '../../src/games/pong/physics';
import { makeRng } from '../../src/games/pool/ai/ai';
import { pongVsRef } from '../bench/pong';

const run = (s: ReturnType<typeof createPong>, secs: number) => {
  for (let i = 0; i < secs / PONG.dt; i++) stepPong(s, makeRng(1));
};

describe('pong — física', () => {
  it('bola quica nas laterais e não sai da quadra por cima/baixo', () => {
    const s = createPong();
    s.freeze = 0;
    s.ball = { x: 1, y: 0.5, vx: 0.2, vy: 3 };
    let minY = 1;
    let maxY = 0;
    for (let i = 0; i < 400; i++) {
      stepPong(s);
      minY = Math.min(minY, s.ball.y);
      maxY = Math.max(maxY, s.ball.y);
    }
    expect(minY).toBeGreaterThanOrEqual(PONG.ballR - 1e-9);
    expect(maxY).toBeLessThanOrEqual(TABLE.h - PONG.ballR + 1e-9);
  });

  it('raquete rebate: centro volta reto, ponta volta inclinada, e a bola acelera', () => {
    for (const [off, expectSteep] of [
      [0, false],
      [0.08, true],
    ] as const) {
      const s = createPong();
      s.freeze = 0;
      s.paddles[0].y = s.paddles[0].ty = 0.5 - off;
      s.ball = { x: 0.4, y: 0.5, vx: -2, vy: 0 };
      run(s, 0.3);
      expect(s.ball.vx).toBeGreaterThan(0);
      expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeGreaterThan(2);
      expect(Math.abs(s.ball.vy) > 1).toBe(expectSteep);
    }
  });

  it('bola que passa ao lado da raquete vira ponto do adversário e volta do meio', () => {
    const s = createPong();
    s.freeze = 0;
    s.paddles[0].y = s.paddles[0].ty = 0.15;
    s.ball = { x: 0.4, y: 0.8, vx: -3, vy: 0 };
    run(s, 0.4);
    expect(s.score).toEqual([0, 1]);
    expect(s.ball.x).toBeCloseTo(TABLE.w / 2, 5);
  });

  it('a raquete respeita a velocidade máxima e não sai da quadra', () => {
    const s = createPong();
    setPaddle(s, 0, 5);
    expect(s.paddles[0].ty).toBe(clampPaddleY(5));
    stepPong(s);
    expect(Math.abs(s.paddles[0].vy)).toBeLessThanOrEqual(PONG.maxPaddle + 1e-6);
  });

  it('a partida termina em 7 pontos', () => {
    const s = createPong();
    for (let k = 0; k < 7; k++) {
      s.freeze = 0;
      s.paddles[0].y = s.paddles[0].ty = 0.1;
      s.ball = { x: 0.5, y: 0.9, vx: -4, vy: 0 };
      run(s, 0.3);
    }
    expect(s.winner).toBe(1);
  });
});

describe('pong — IA', () => {
  it('a IA alcança uma bola reta no Difícil', () => {
    const s = createPong(1);
    s.freeze = 0;
    s.ball = { x: 1.2, y: 0.2, vx: 2.5, vy: 0.6 };
    const ai = new PongAI('hard', makeRng(1));
    for (let i = 0; i < 0.5 / PONG.dt; i++) {
      ai.update(s, PONG.dt);
      stepPong(s);
    }
    expect(s.score[0]).toBe(0);
    expect(s.ball.vx).toBeLessThan(0);
    expect(paddleX(1)).toBeGreaterThan(1.8);
  });

  it('níveis contra a referência: Fácil < Médio < Difícil, com folga', () => {
    const e = pongVsRef('easy', 4, 90).share;
    const m = pongVsRef('medium', 4, 90).share;
    const h = pongVsRef('hard', 4, 90).share;
    expect(e).toBeLessThan(0.3);
    expect(m).toBeGreaterThan(e + 0.15);
    expect(h).toBeGreaterThan(m + 0.15);
  }, 60_000);
});

// Leon (03/11): conferir se o hitbox da raquete bate com o desenho. Colisão = bola encostando na face desenhada
// (retângulo paddleW × paddleH), incluindo o raio da bola: borda de contato a paddleH/2 + ballR do centro.
describe('pong — hitbox igual ao desenho da raquete', () => {
  const shoot = (dy: number) => {
    const s = createPong(0, () => 0.5);
    s.freeze = 0;
    const face = paddleX(0) + PONG.paddleW / 2;
    s.ball = { x: face + PONG.ballR + 0.05, y: TABLE.h / 2 + dy, vx: -2, vy: 0 };
    for (let i = 0; i < 240 && s.ball.vx < 0 && s.ball.x > 0; i++) stepPong(s);
    return s.ball.vx > 0;
  };
  it('rebate encostando na ponta e passa logo depois dela (diferença de 1 mm)', () => {
    const edge = PONG.paddleH / 2 + PONG.ballR;
    expect(shoot(0)).toBe(true);
    expect(shoot(edge - 0.001)).toBe(true);
    expect(shoot(-(edge - 0.001))).toBe(true);
    expect(shoot(edge + 0.001)).toBe(false);
    expect(shoot(-(edge + 0.001))).toBe(false);
  });
});
