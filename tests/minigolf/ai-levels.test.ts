import { describe, expect, it } from 'vitest';
import { golfRound } from '../bench/minigolf';

describe('minigolfe — IA medida (tacadas nos 9 buracos, menos = melhor)', () => {
  it('Fácil > Médio > Difícil com folga', () => {
    const avg = (d: 'easy' | 'medium' | 'hard') => [1, 2, 3].reduce((a, s) => a + golfRound(d, s).total, 0) / 3;
    const e = avg('easy');
    const m = avg('medium');
    const h = avg('hard');
    expect(e).toBeGreaterThan(m + 3);
    expect(m).toBeGreaterThan(h + 2);
  }, 300000);
});
