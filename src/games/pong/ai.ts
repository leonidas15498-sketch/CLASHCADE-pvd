import type { Difficulty } from '../shared/shell';
import { paddleX, PONG, PongState, setPaddle, TABLE } from './physics';

/**
 * IA do Pong (mesmo modelo da IA do Air Hockey): decide a cada `reaction` segundos olhando a bola,
 * prevê onde ela chega (com tabelas nas laterais) e leva a raquete até lá com parte da velocidade máxima.
 * O Difícil escolhe em que parte da raquete bater para mandar a bola longe do adversário.
 */
export interface PongCfg {
  reaction: number;
  aimError: number;
  speedScale: number;
  lapse: number;
  /** Volta para o meio enquanto a bola está indo embora. */
  recenter: boolean;
  /** Mira: escolhe a parte da raquete (0 = sempre o centro). */
  aim: number;
}
export const PONG_AI: Record<Difficulty, PongCfg> = {
  easy: { reaction: 0.26, aimError: 0.11, speedScale: 0.7, lapse: 0.13, recenter: true, aim: 0 },
  medium: { reaction: 0.2, aimError: 0.075, speedScale: 0.7, lapse: 0.1, recenter: true, aim: 0.25 },
  hard: { reaction: 0.08, aimError: 0.02, speedScale: 0.95, lapse: 0.03, recenter: true, aim: 0.8 },
};

export function reflectY(y: number): number {
  const R = PONG.ballR;
  const H = TABLE.h - 2 * R;
  let v = y - R;
  v = ((v % (2 * H)) + 2 * H) % (2 * H);
  if (v > H) v = 2 * H - v;
  return v + R;
}

export class PongAI {
  private timer = 0;
  private target = TABLE.h / 2;
  constructor(
    public difficulty: Difficulty,
    private rng: () => number = Math.random,
    private me: 0 | 1 = 1,
    private cfgOverride?: PongCfg,
  ) {}

  get cfg(): PongCfg {
    return this.cfgOverride ?? PONG_AI[this.difficulty];
  }

  update(s: PongState, dt: number): void {
    const c = this.cfg;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = c.reaction * (0.75 + this.rng() * 0.5);
      if (this.rng() >= c.lapse) this.target = this.decide(s, c);
    }
    const p = s.paddles[this.me];
    const d = this.target - p.y;
    const max = PONG.maxPaddle * c.speedScale * dt;
    setPaddle(s, this.me, p.y + (Math.abs(d) > max ? Math.sign(d) * max : d));
  }

  private decide(s: PongState, c: PongCfg): number {
    const b = s.ball;
    const toward = this.me === 1 ? b.vx > 0 : b.vx < 0;
    if (!toward || s.freeze > 0) return c.recenter ? TABLE.h / 2 : s.paddles[this.me].y;
    const x = paddleX(this.me);
    const t = Math.abs((x - b.x) / b.vx);
    const y = reflectY(b.y + b.vy * t) + (this.rng() - 0.5) * 2 * c.aimError;
    // mira: bate com a ponta da raquete que manda a bola para longe do adversário
    const opp = s.paddles[1 - this.me];
    const wantUp = opp.y > TABLE.h / 2; // adversário embaixo → mandar para cima (y menor)
    const off = c.aim * (PONG.paddleH / 2) * (wantUp ? 1 : -1);
    return y + off;
  }
}
