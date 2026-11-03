import type { Difficulty } from '../shared/shell';
import { tap, TugState } from './logic';

/**
 * IA do Cabo de Guerra: toca uma vez por batida com erro de tempo (desvio-padrão) e chance de esquecer,
 * julgada pelas MESMAS janelas do humano. Não "vê" o futuro: só sabe os instantes das batidas, como quem ouve.
 * Referência de gente (suposição, sem medição própria): toque no ritmo de leigo erra ~40–80 ms.
 */
export interface TugAICfg {
  sigma: number;
  /** Atraso médio (s): leigo tende a tocar um pouco depois. */
  bias: number;
  miss: number;
}
export const TUG_AI: Record<Difficulty, TugAICfg> = {
  easy: { sigma: 0.085, bias: 0.035, miss: 0.16 },
  medium: { sigma: 0.055, bias: 0.015, miss: 0.07 },
  hard: { sigma: 0.03, bias: 0.005, miss: 0.025 },
};

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export class TugAI {
  private planned = new Map<number, number>();
  private nextBeat = 0;
  constructor(
    public difficulty: Difficulty,
    private me: 0 | 1 = 1,
    private rng: () => number = Math.random,
  ) {}

  /** Chamar com o tempo atual da partida; toca as batidas agendadas que já venceram. */
  update(s: TugState, t: number) {
    const c = TUG_AI[this.difficulty];
    // agenda as batidas que estão chegando (0,5 s à frente)
    while (this.nextBeat < s.beats.length && s.beats[this.nextBeat] < t + 0.5) {
      if (this.rng() >= c.miss) this.planned.set(this.nextBeat, s.beats[this.nextBeat] + c.bias + gauss(this.rng) * c.sigma);
      this.nextBeat++;
    }
    for (const [k, when] of this.planned)
      if (t >= when) {
        tap(s, this.me, when);
        this.planned.delete(k);
      }
  }
}
