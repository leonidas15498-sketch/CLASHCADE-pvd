import type { Difficulty } from '../shared/shell';
import { AIM_LIMIT, simulateDrop, StackMatch } from './logic';

/**
 * IA do Empilha: testa posições e giros simulando a MESMA física (cópia do mundo) e escolhe a jogada mais estável.
 * Depois aplica um erro de mão (desvio na posição) conforme o nível — igual à sinuca.
 */
export interface StackAICfg {
  /** Passo entre posições testadas (u). */
  stepX: number;
  angles: number[];
  /** Desvio-padrão do erro de posição (u). */
  handSigma: number;
  /** Chance de jogar "no olho", sem pensar (posição aleatória perto do centro). */
  careless: number;
  /** Prefere posições cujas vizinhas também são seguras (margem contra erro e caos da física). */
  robust: boolean;
}
const Q = Math.PI / 2;
export const STACK_AI: Record<Difficulty, StackAICfg> = {
  easy: { stepX: 1.2, angles: [0], handSigma: 0.7, careless: 0.4, robust: false }, // 01/11: 0,42→0,7 e 0,3→0,4 (física mais amortecida perdoava demais o Fácil)
  medium: { stepX: 0.45, angles: [0, Q], handSigma: 0.1, careless: 0.04, robust: false }, // 01/11: 0,12→0,1 (física nova)
  hard: { stepX: 0.2, angles: [0, Q, -Q, 2 * Q], handSigma: 0.03, careless: 0, robust: true },
};

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export type Drop = { x: number; angle: number };

/**
 * Planejador em partes: cada `next()` testa uma candidata. O jogo roda alguns por quadro (sem travar a tela);
 * os testes rodam tudo de uma vez com chooseStackDrop.
 */
export function* planStackDrop(m: StackMatch, d: Difficulty, rng: () => number): Generator<void, Drop, void> {
  const c = STACK_AI[d];
  const snap = m.sw.snapshot();
  if (rng() < c.careless) return { x: (rng() - 0.5) * 2.6, angle: c.angles[0] };
  let best = { x: 0, angle: 0, score: -Infinity };
  for (const angle of c.angles) {
    const hy = m.holdY(angle);
    const xs: number[] = [];
    const sc: number[] = [];
    for (let x = -2.4; x <= 2.4 + 1e-9; x += c.stepX) {
      const r = simulateDrop(snap, m.piece, x, angle, hy);
      xs.push(x);
      sc.push(r.fell ? -1000 + r.fellAt : -r.disturb * 4 - r.top * 0.5 - r.tilt * 0.6 - Math.abs(Math.sin(angle)) * 0.05 - Math.abs(x) * 0.08 + rng() * 0.05);
      yield;
    }
    for (let i = 0; i < xs.length; i++) {
      let score = sc[i];
      if (c.robust) score = 0.6 * score + 0.4 * Math.min(sc[Math.max(0, i - 1)], sc[Math.min(xs.length - 1, i + 1)]);
      if (score > best.score) best = { x: xs[i], angle, score };
    }
  }
  const x = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, best.x + gauss(rng) * c.handSigma));
  return { x, angle: best.angle };
}

export function chooseStackDrop(m: StackMatch, d: Difficulty, rng: () => number): Drop {
  const it = planStackDrop(m, d, rng);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
