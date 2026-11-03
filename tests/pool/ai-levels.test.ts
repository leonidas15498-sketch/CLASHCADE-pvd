import { describe, expect, it } from 'vitest';
import { matchRate, potRate } from '../bench/pool';

// Pedido do Leon (01/11): cada nível precisa ser o que diz, com folga entre eles.
describe('sinuca — níveis da IA', () => {
  it('taxa de encaçapar em mesas aleatórias: Fácil < Médio < Difícil, com folga', () => {
    const e = potRate('easy');
    const m = potRate('medium');
    const h = potRate('hard');
    expect(m.pot).toBeGreaterThan(e.pot + 0.12);
    expect(h.pot).toBeGreaterThan(m.pot + 0.2);
    expect(h.pot).toBeGreaterThanOrEqual(0.65);
    expect(h.foul).toBeLessThan(m.foul);
  }, 120_000);

  it('em partidas completas o nível de cima vence o de baixo na maioria', () => {
    expect(matchRate('hard', 'medium', 8)).toBeGreaterThanOrEqual(0.6);
    expect(matchRate('medium', 'easy', 8)).toBeGreaterThanOrEqual(0.6);
  }, 180_000);
});
