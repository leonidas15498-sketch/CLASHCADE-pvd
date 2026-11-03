import type { Difficulty } from '../shared/shell';
import { dash, ringRadius, setInput, SUMO, SumoState } from './logic';

/**
 * IA do Sumô Neon: usa os MESMOS controles do humano (joystick |v| ≤ 1 e avanço com recarga).
 * Enxerga o mundo com atraso (reação) e erra a mira conforme o nível.
 * - Fácil: vai direto no rival, reação lenta, avança "no olho" e não cuida da borda.
 * - Médio: se posiciona entre o rival e o centro (empurra para fora), foge da borda, avança alinhado.
 * - Difícil: igual ao Médio + prevê o movimento do rival, desvia de avanço perto da borda e só avança com o
 *   rival de costas para a borda.
 */
export interface SumoAICfg {
  reaction: number;
  aimErr: number;
  edgeCare: number;
  /** Chance por segundo de avançar quando a regra de avanço permite. */
  dashRate: number;
  predict: number;
  dodge: boolean;
  positional: boolean;
}
export const SUMO_AI: Record<Difficulty, SumoAICfg> = {
  easy: { reaction: 0.38, aimErr: 0.5, edgeCare: 0, dashRate: 0.9, predict: 0, dodge: false, positional: false },
  medium: { reaction: 0.22, aimErr: 0.2, edgeCare: 0.72, dashRate: 2.2, predict: 0.1, dodge: false, positional: true },
  hard: { reaction: 0.12, aimErr: 0.08, edgeCare: 0.8, dashRate: 4, predict: 0.25, dodge: true, positional: true },
};

type Seen = { t: number; ox: number; oy: number; ovx: number; ovy: number; ocd: number };

export class SumoAI {
  private seen: Seen[] = [];
  private errA = 0;
  private errT = 0;
  constructor(
    public difficulty: Difficulty,
    private me: 0 | 1 = 1,
    private rng: () => number = Math.random,
  ) {}

  update(s: SumoState, dt: number) {
    const c = SUMO_AI[this.difficulty];
    const o = s.w[1 - this.me];
    this.seen.push({ t: s.t, ox: o.x, oy: o.y, ovx: o.vx, ovy: o.vy, ocd: o.cd });
    while (this.seen.length > 2 && s.t - this.seen[1].t > c.reaction) this.seen.shift();
    const v = this.seen[0];
    if (s.freeze > 0 || s.between > 0 || s.winner !== null) {
      setInput(s, this.me, 0, 0);
      return;
    }
    // erro de mira muda devagar (mão humana não treme a 120 Hz)
    this.errT -= dt;
    if (this.errT <= 0) {
      this.errT = 0.35 + this.rng() * 0.3;
      this.errA = (this.rng() * 2 - 1) * c.aimErr;
    }
    const w = s.w[this.me];
    const R = ringRadius(s.rt);
    const ox = v.ox + v.ovx * c.predict;
    const oy = v.oy + v.ovy * c.predict;
    let tx = ox - w.x;
    let ty = oy - w.y;
    const dist = Math.hypot(tx, ty);
    if (c.positional) {
      // ponto "atrás" do rival em relação ao centro: empurrar de dentro para fora
      const or = Math.hypot(ox, oy) || 1;
      const bx = ox - (ox / or) * SUMO.bodyR * 2.2;
      const by = oy - (oy / or) * SUMO.bodyR * 2.2;
      const myR = Math.hypot(w.x, w.y);
      // se já estou mais perto do centro que o rival, vai direto nele; senão contorna para ficar por dentro
      if (myR > or - 0.05) {
        tx = bx - w.x;
        ty = by - w.y;
      }
    }
    // borda: puxa para o centro proporcionalmente ao perigo
    const myR = Math.hypot(w.x, w.y);
    let ix = tx;
    let iy = ty;
    const m = Math.hypot(ix, iy) || 1;
    ix /= m;
    iy /= m;
    if (c.edgeCare > 0 && myR > R * c.edgeCare) {
      const k = Math.min(1, (myR - R * c.edgeCare) / (R * (1 - c.edgeCare) + 1e-6)) * 1.6;
      ix -= (w.x / myR) * k;
      iy -= (w.y / myR) * k;
    }
    // desvio: rival com avanço pronto vindo rápido na minha direção e eu perto da borda → sai de lado
    if (c.dodge && dist < 0.7) {
      const rel = (v.ovx * (w.x - v.ox) + v.ovy * (w.y - v.oy)) / (dist || 1);
      if (rel > 1.2 && myR > R * 0.55) {
        const px = -(w.y - v.oy) / (dist || 1);
        const py = (w.x - v.ox) / (dist || 1);
        const side = px * -w.x + py * -w.y > 0 ? 1 : -1;
        ix = px * side - (w.x / (myR || 1)) * 0.4;
        iy = py * side - (w.y / (myR || 1)) * 0.4;
      }
    }
    const ca = Math.cos(this.errA);
    const sa = Math.sin(this.errA);
    setInput(s, this.me, ix * ca - iy * sa, ix * sa + iy * ca);
    // avanço
    if (w.cd <= 0 && dist < 0.75 && this.rng() < c.dashRate * dt) {
      const ux = tx / (Math.hypot(tx, ty) || 1);
      const uy = ty / (Math.hypot(tx, ty) || 1);
      const toward = (ox - w.x) / (dist || 1);
      const towardY = (oy - w.y) / (dist || 1);
      const aligned = ux * toward + uy * towardY > 0.8;
      const orR = Math.hypot(ox, oy);
      const rivalNearEdge = orR > R * 0.45;
      if (!c.positional || (aligned && (!c.dodge || rivalNearEdge || dist < 0.4))) dash(s, this.me);
    }
  }
}
