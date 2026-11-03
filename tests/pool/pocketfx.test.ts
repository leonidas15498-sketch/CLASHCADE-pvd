import { describe, expect, it } from 'vitest';
import { DROP_TIME, fxFrame, HIDDEN_TIME, PocketAnim, railTime, RailGeom, slotY } from '../../src/games/pool/game/pocketFx';

const rail: RailGeom = { x: 2.8, topY: -0.1, bottomY: 1.39, R: 0.028575 };
const anim = (slot: number | null): PocketAnim => ({ id: 5, fromX: 1, fromY: 0.2, pocketX: 1.27, pocketY: -0.035, t0: 10, q: [1, 0, 0, 0], slot });

describe('animação das bolas encaçapadas', () => {
  it('cai na boca: termina no centro da caçapa, menor e escura', () => {
    const f0 = fxFrame(anim(0), 10, rail);
    expect(f0.stage).toBe('drop');
    expect(f0.x).toBeCloseTo(1, 9);
    const f1 = fxFrame(anim(0), 10 + DROP_TIME * 0.999, rail);
    expect(f1.x).toBeCloseTo(1.27, 3);
    expect(f1.scale).toBeLessThan(0.6);
    expect(f1.dark).toBeGreaterThan(0.8);
  });

  it('depois aparece no alto da canaleta, desce acelerando e para na sua vaga', () => {
    const t1 = 10 + DROP_TIME + HIDDEN_TIME;
    const T = railTime(rail, 2);
    const a = fxFrame(anim(2), t1 + T * 0.3, rail);
    const b = fxFrame(anim(2), t1 + T * 0.6, rail);
    expect(a.stage).toBe('rail');
    expect(b.y).toBeGreaterThan(a.y);
    expect(b.y - a.y).toBeGreaterThan(a.y - (rail.topY + rail.R)); // acelera
    const end = fxFrame(anim(2), t1 + T + 1, rail);
    expect(end.stage).toBe('done');
    expect(end.y).toBeCloseTo(slotY(rail, 2), 9);
  });

  it('vagas empilham de baixo para cima sem sobreposição', () => {
    for (let k = 0; k < 14; k++) expect(slotY(rail, k) - slotY(rail, k + 1)).toBeGreaterThanOrEqual(2 * rail.R);
    expect(slotY(rail, 14) - rail.R).toBeGreaterThan(rail.topY);
  });

  it('branca só faz a queda (não vai para a canaleta)', () => {
    expect(fxFrame(anim(null), 10 + DROP_TIME + 0.01, rail).stage).toBe('done');
  });
});
