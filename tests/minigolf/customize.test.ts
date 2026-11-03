import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { aimRay, createWorld, step, strike } from '../../src/games/minigolf/physics/sim';
import { COURSE_THEMES } from '../../src/games/minigolf/render/courses';
import { CUSTOM_GRIPS, CUSTOM_HEADS, CUSTOM_SHAFTS, customPutter, DEFAULT_CUSTOM, isValidCustom, PUTTERS } from '../../src/games/minigolf/render/putters';
import { TABLE_THEMES } from '../../src/games/pool/game/tables';

describe('prévia da tabela no minigolfe', () => {
  it('a direção de saída prevista bate com a da bola simulada após o 1º toque', () => {
    const lv = LEVELS[2]; // "Tabela"
    for (const deg of [35, 50, -40, 140]) {
      const ang = (deg * Math.PI) / 180;
      const ray = aimRay(lv, lv.tee, ang, 0, 200);
      expect(ray.hit).toBe(true);
      if (!ray.bounce) continue; // toque em obstáculo móvel não tem prévia
      const w = createWorld(lv, lv.tee, 0);
      strike(w, ang, 0.9);
      let n = 0;
      while (w.events.filter((e) => e.type === 'wall').length === 0 && n++ < 5000) step(w);
      // alguns passos depois do toque, a velocidade aponta para a direção prevista
      for (let k = 0; k < 3; k++) step(w);
      const sp = Math.hypot(w.vx, w.vy);
      const cos = (w.vx * ray.bounce.x + w.vy * ray.bounce.y) / sp;
      expect(cos).toBeGreaterThan(0.995);
    }
  });
});

describe('personalização', () => {
  it('taco personalizado aceita só opções do catálogo e gera cores válidas', () => {
    expect(isValidCustom(DEFAULT_CUSTOM)).toBe(true);
    expect(isValidCustom({ head: '#123456', shaft: 'aco', grip: '#1d1d1d' })).toBe(false);
    expect(isValidCustom({ head: CUSTOM_HEADS[0], shaft: 'plastico', grip: CUSTOM_GRIPS[0] })).toBe(false);
    for (const h of CUSTOM_HEADS)
      for (const sh of CUSTOM_SHAFTS) {
        const p = customPutter({ head: h, shaft: sh.id, grip: CUSTOM_GRIPS[1] });
        expect(p.tier).toBe('free');
        expect(p.head.every((c) => /^rgb\(\d+,\d+,\d+\)$/.test(c))).toBe(true);
      }
  });
  it('catálogos têm ids únicos e itens grátis', () => {
    for (const list of [PUTTERS, TABLE_THEMES, COURSE_THEMES] as { id: string; tier: string }[][]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      expect(list.some((x) => x.tier === 'free')).toBe(true);
    }
  });
});
