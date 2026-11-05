import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/games/minigolf/levels/levels';
import { simulateShot } from '../../src/games/minigolf/physics/sim';

/**
 * Pedido do Leon (01/11): todo buraco precisa permitir hole in one. Tacadas achadas pela varredura
 * `npx vite-node scripts/golfe-hole-in-one.ts 0.5 0.01` (graus, força 0–1, instante t0 dos obstáculos móveis).
 * Cada uma é conferida junto com 14 vizinhas (±0,25° e ±1% de força): precisa ter folga, não ser um ponto isolado.
 */
const ACES: Record<number, [number, number, number]> = {
  1: [0, 0.64, 0],
  2: [33, 1, 0],
  3: [27.5, 0.82, 0],
  4: [0, 0.87, 0],
  5: [0, 0.67, 0],
  6: [339, 0.8, 0.7],
  7: [20, 0.72, 0],
  8: [0, 0.67, 0.8], // 05/11: portão menor (bola não fica mais espremida); 852 combinações com folga na varredura
  9: [32, 0.96, 1.4],
  // 05/11: buracos novos (raros de propósito: tabela no pino, passagem entre as pás, tabela raspando o pino)
  10: [37, 1, 0],
  11: [18, 0.84, 1.6],
  12: [31, 0.96, 0],
};

describe('minigolfe — hole in one possível em todos os buracos', () => {
  for (const lv of LEVELS) {
    it(`buraco ${lv.id} (${lv.name})`, () => {
      const [deg, p, t0] = ACES[lv.id];
      let ok = 0;
      for (const da of [-0.25, 0, 0.25]) for (const dp of [-0.01, -0.005, 0, 0.005, 0.01]) {
        if (simulateShot(lv, lv.tee, t0, ((deg + da) * Math.PI) / 180, Math.min(1, p + dp)).status === 'holed') ok++;
      }
      expect(ok).toBeGreaterThanOrEqual(12);
    });
  }
});
