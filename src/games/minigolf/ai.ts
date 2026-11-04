/**
 * IA do Minigolfe (04/11). Usa o MESMO simulador da partida para testar tacadas (ângulo × força) e escolhe a que
 * cai no buraco ou deixa a bola mais perto pelo caminho do buraco. Depois aplica um erro de mão por nível,
 * como um jogador de verdade: o motor é igual para todos, o que muda é a precisão.
 * - Fácil: grade grossa e erro grande (≈ 9° e 25% de força).
 * - Médio: grade média e erro moderado (≈ 4° e 10%).
 * - Difícil: grade fina com refinamento em volta da melhor e erro pequeno (≈ 1,2° e 3,5%).
 * Medido em tests/bench/minigolf.ts (tacadas nos 9 buracos).
 */
import type { Difficulty } from '../shared/shell';
import { findShot, routeRemaining } from './levels/solver';
import { simulateShot } from './physics/sim';
import type { Level, Vec } from './physics/types';

const CFG: Record<Difficulty, { step: number; refine: boolean; angErr: number; powErr: number }> = {
  easy: { step: 6, refine: false, angErr: 9, powErr: 0.25 },
  medium: { step: 4, refine: false, angErr: 4, powErr: 0.1 },
  hard: { step: 3, refine: true, angErr: 1.2, powErr: 0.035 },
};

/** Número com distribuição aproximadamente normal (média 0, desvio 1). */
const gauss = (rng: () => number) => (rng() + rng() + rng() + rng() - 2) * 1.73;

export function chooseGolfShot(level: Level, from: Vec, t: number, d: Difficulty, rng: () => number): { angle: number; power: number } {
  const c = CFG[d];
  let best = findShot(level, from, t, c.step);
  if (c.refine) {
    let bestScore = best.status === 'holed' ? -1000 + best.power : routeRemaining(level.route, best);
    for (let da = -2; da <= 2; da += 0.5)
      for (const dp of [-0.06, -0.03, 0, 0.03, 0.06]) {
        const angle = best.angle + (da * Math.PI) / 180;
        const power = Math.min(1, Math.max(0.05, best.power + dp));
        const r = simulateShot(level, from, t, angle, power);
        const score = r.status === 'holed' ? -1000 + power : r.status === 'out' ? 1e6 : routeRemaining(level.route, r);
        if (score < bestScore) {
          bestScore = score;
          best = { angle, power, status: r.status, x: r.x, y: r.y, t: r.t };
        }
      }
  }
  const angle = best.angle + (gauss(rng) * c.angErr * Math.PI) / 180;
  const power = Math.min(1, Math.max(0.05, best.power * (1 + gauss(rng) * c.powErr)));
  return { angle, power };
}
