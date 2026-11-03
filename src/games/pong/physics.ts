/**
 * Pong — física pura (sem DOM). Mesma mesa e unidades do Air Hockey (2,0 × 1,0 m, passo fixo 1/240 s,
 * jogador 1 à esquerda, 2 à direita, primeiro a 7). As raquetes só andam na vertical, com velocidade máxima.
 * A bola sai da raquete num ângulo que depende de onde bateu (centro = reto, ponta = até 60°).
 */
import { TABLE } from '../airhockey/physics';

export { TABLE };
export const PONG = {
  dt: 1 / 240,
  paddleH: 0.18,
  paddleW: 0.035,
  /** Distância da raquete até o fundo. */
  paddleX: 0.08,
  ballR: 0.022,
  /**
   * Ritmo "normal confortável" (brief de 01/11, pedido de desacelerar): saque 1,7 m/s (cruza 2 m em ~1,2 s),
   * +7% por rebatida até 4,4 m/s (~0,45 s por travessia; antes 6 m/s = 0,33 s). Antes: 2,2 / 10% / 6 / 2,8 / 60°.
   * O brief sugeria 3,8 m/s e +5%: medido, dava 110–170 rebatidas por ponto entre robôs (partida sem fim).
   */
  serveSpeed: 1.7,
  speedUp: 1.07,
  maxBall: 4.4,
  maxPaddle: 2.6,
  maxAngle: (55 * Math.PI) / 180,
  pointsToWin: 7,
};

export interface Paddle {
  y: number;
  ty: number;
  vy: number;
}
export type PongEvent = { type: 'wall' } | { type: 'hit'; player: 0 | 1; speed: number } | { type: 'point'; scorer: 0 | 1 };

export interface PongState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: [Paddle, Paddle];
  score: [number, number];
  freeze: number;
  serveTo: 0 | 1;
  winner: 0 | 1 | null;
  events: PongEvent[];
  t: number;
  rally: number;
}

export const paddleX = (p: 0 | 1) => (p === 0 ? PONG.paddleX : TABLE.w - PONG.paddleX);

export function createPong(serveTo: 0 | 1 = 0, rng: () => number = Math.random): PongState {
  const s: PongState = {
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    paddles: [
      { y: TABLE.h / 2, ty: TABLE.h / 2, vy: 0 },
      { y: TABLE.h / 2, ty: TABLE.h / 2, vy: 0 },
    ],
    score: [0, 0],
    freeze: 1,
    serveTo,
    winner: null,
    events: [],
    t: 0,
    rally: 0,
  };
  serve(s, serveTo, rng);
  return s;
}

/** Bola no centro indo para quem vai receber, com ângulo leve aleatório. */
export function serve(s: PongState, to: 0 | 1, rng: () => number = Math.random): void {
  const a = (rng() - 0.5) * 0.7;
  const dir = to === 0 ? -1 : 1;
  s.ball = { x: TABLE.w / 2, y: TABLE.h * (0.3 + rng() * 0.4), vx: Math.cos(a) * PONG.serveSpeed * dir, vy: Math.sin(a) * PONG.serveSpeed };
  s.rally = 0;
}

export function clampPaddleY(y: number): number {
  const h = PONG.paddleH / 2;
  return Math.min(TABLE.h - h, Math.max(h, y));
}

export function setPaddle(s: PongState, p: 0 | 1, y: number): void {
  s.paddles[p].ty = clampPaddleY(y);
}

export function stepPong(s: PongState, rng: () => number = Math.random): void {
  const dt = PONG.dt;
  s.t += dt;
  for (const p of s.paddles) {
    const d = p.ty - p.y;
    const max = PONG.maxPaddle * dt;
    const m = Math.abs(d) > max ? Math.sign(d) * max : d;
    p.vy = m / dt;
    p.y += m;
  }
  if (s.winner !== null) return;
  if (s.freeze > 0) {
    s.freeze = Math.max(0, s.freeze - dt);
    return;
  }
  const b = s.ball;
  const R = PONG.ballR;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.y < R && b.vy < 0) {
    b.y = R;
    b.vy = -b.vy;
    s.events.push({ type: 'wall' });
  } else if (b.y > TABLE.h - R && b.vy > 0) {
    b.y = TABLE.h - R;
    b.vy = -b.vy;
    s.events.push({ type: 'wall' });
  }
  for (const p of [0, 1] as const) {
    const px = paddleX(p);
    const face = p === 0 ? px + PONG.paddleW / 2 : px - PONG.paddleW / 2;
    const coming = p === 0 ? b.vx < 0 : b.vx > 0;
    if (!coming) continue;
    const prevX = b.x - b.vx * dt;
    const crossed = p === 0 ? prevX - R >= face && b.x - R < face : prevX + R <= face && b.x + R > face;
    if (!crossed) continue;
    const pad = s.paddles[p];
    const off = (b.y - pad.y) / (PONG.paddleH / 2 + R);
    if (Math.abs(off) > 1) continue; // passou ao lado da raquete
    const sp = Math.min(PONG.maxBall, Math.hypot(b.vx, b.vy) * PONG.speedUp);
    const ang = Math.max(-1, Math.min(1, off)) * PONG.maxAngle;
    const dir = p === 0 ? 1 : -1;
    b.vx = Math.cos(ang) * sp * dir;
    b.vy = Math.sin(ang) * sp;
    b.x = p === 0 ? face + R : face - R;
    s.rally++;
    s.events.push({ type: 'hit', player: p, speed: sp });
  }
  if (b.x < -R || b.x > TABLE.w + R) {
    const scorer: 0 | 1 = b.x < 0 ? 1 : 0;
    s.score[scorer]++;
    s.events.push({ type: 'point', scorer });
    if (s.score[scorer] >= PONG.pointsToWin) s.winner = scorer;
    s.freeze = 0.9;
    s.serveTo = (1 - scorer) as 0 | 1;
    serve(s, s.serveTo, rng);
  }
}
