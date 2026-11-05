import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { createMatch, starter, advance, applyShot } from '../../src/games/minigolf/rules/rules';
import { makeRng } from '../../src/games/pool/ai/ai';
import { circuit } from '../../src/games/minigolf/ui/app';

describe('minigolfe — circuito sorteado e quem sai (05/11)', () => {
  it('todos os buracos, sem repetir, ordem varia, começa por um buraco de aprendizado', () => {
    const rng = makeRng(7);
    const orders = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const c = circuit(rng);
      expect([...c].sort((a, b) => a - b)).toEqual(LEVELS.map((_, i) => i));
      expect(c[0]).toBeLessThan(3);
      orders.add(c.join(','));
    }
    expect(orders.size).toBeGreaterThan(35);
  });

  it('a saída alterna a cada buraco a partir do sorteado', () => {
    for (const first of [0, 1]) {
      let m = createMatch('duo', ['A', 'B'], [0, 1, 2, 3], LEVELS[0].tee, first);
      const seen: number[] = [];
      for (let h = 0; h < 4; h++) {
        seen.push(m.current);
        expect(m.current).toBe(starter(m));
        m = applyShot(m, { kind: 'holed' });
        m = applyShot(m, { kind: 'holed' });
        m = advance(m, LEVELS[0].tee);
      }
      expect(seen).toEqual(first === 0 ? [0, 1, 0, 1] : [1, 0, 1, 0]);
    }
  });
});
