/**
 * Animações puramente visuais das bolas encaçapadas (sem DOM, testável):
 *  1) "drop": a bola escorrega para o centro da caçapa, encolhe e escurece (cai no buraco);
 *  2) "hidden": percorre por baixo da mesa;
 *  3) "rail": aparece no alto da canaleta à direita da mesa e desce rolando até sua vaga,
 *     empilhando na ordem em que caiu.
 * Não interfere na física nem nas regras.
 */
export interface PocketAnim {
  id: number;
  fromX: number;
  fromY: number;
  pocketX: number;
  pocketY: number;
  t0: number;
  /** Orientação da bola no instante em que caiu (continua girando na queda). */
  q: [number, number, number, number];
  /** Vaga na canaleta (0 = mais baixa). null = branca (não vai para a canaleta). */
  slot: number | null;
}

export interface RailGeom {
  x: number;
  topY: number;
  bottomY: number;
  R: number;
}

export const DROP_TIME = 0.32;
export const HIDDEN_TIME = 0.3;
/** Aceleração aparente na canaleta inclinada (m/s²). */
export const RAIL_ACCEL = 2.2;

export type FxStage = 'drop' | 'hidden' | 'rail' | 'done';

export interface FxFrame {
  stage: FxStage;
  x: number;
  y: number;
  scale: number;
  dark: number;
  q: [number, number, number, number];
}

export const slotY = (rail: RailGeom, slot: number) => rail.bottomY - rail.R - slot * (2 * rail.R + 0.003);

const rollQ = (angle: number): [number, number, number, number] => [Math.cos(angle / 2), Math.sin(angle / 2), 0, 0];

export function railTime(rail: RailGeom, slot: number): number {
  const d = Math.max(0, slotY(rail, slot) - (rail.topY + rail.R));
  return Math.sqrt((2 * d) / RAIL_ACCEL);
}

/** Estado visual da animação no instante `now` (segundos). */
export function fxFrame(a: PocketAnim, now: number, rail: RailGeom): FxFrame {
  const t = Math.max(0, now - a.t0);
  if (t < DROP_TIME) {
    const u = t / DROP_TIME;
    const e = 1 - (1 - u) * (1 - u); // desacelera ao chegar no centro da boca
    const spin = u * 2.5; // gira enquanto cai
    const [w, x, y, z] = a.q;
    const c = Math.cos(spin / 2);
    const s = Math.sin(spin / 2);
    return {
      stage: 'drop',
      x: a.fromX + (a.pocketX - a.fromX) * e,
      y: a.fromY + (a.pocketY - a.fromY) * e,
      scale: 1 - 0.45 * u * u,
      dark: 0.85 * u,
      q: [c * w - s * x, c * x + s * w, c * y - s * z, c * z + s * y],
    };
  }
  if (a.slot === null) return { stage: 'done', x: a.pocketX, y: a.pocketY, scale: 0, dark: 1, q: a.q };
  const target = slotY(rail, a.slot);
  const start = rail.topY + rail.R;
  if (t < DROP_TIME + HIDDEN_TIME) return { stage: 'hidden', x: rail.x, y: start, scale: 0, dark: 0, q: rollQ(0) };
  const tr = t - DROP_TIME - HIDDEN_TIME;
  const T = railTime(rail, a.slot);
  if (tr < T) {
    const y = start + 0.5 * RAIL_ACCEL * tr * tr;
    return { stage: 'rail', x: rail.x, y, scale: 1, dark: 0, q: rollQ((y - start) / rail.R) };
  }
  return { stage: 'done', x: rail.x, y: target, scale: 1, dark: 0, q: rollQ((target - start) / rail.R) };
}
