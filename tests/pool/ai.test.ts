import { describe, expect, it } from 'vitest';
import { chooseAIShot, makeRng, potCandidates } from '../../src/games/pool/ai/ai';
import { GameController } from '../../src/games/pool/game/controller';
import { getBall } from '../../src/games/pool/physics/world';
import { Difficulty, groupBalls } from '../../src/games/pool/rules/rules';

/** Mesa com poucas bolas, IA com lisas e vez dela. */
function scenario(): GameController {
  const g = new GameController({ mode: 'ai', difficulty: 'hard' });
  const keep: Record<number, [number, number]> = {
    0: [0.9, 0.7],
    3: [1.5, 0.45],
    5: [0.6, 1.0],
    12: [1.9, 0.9],
    8: [2.1, 0.3],
    14: [1.2, 0.95],
  };
  for (const b of g.world.balls) {
    const k = keep[b.id];
    if (k) {
      b.x = b.px = k[0];
      b.y = b.py = k[1];
    } else b.pocketed = true;
  }
  g.match = {
    ...g.match,
    isBreak: false,
    tableOpen: false,
    ballInHand: 'none',
    current: 1,
    players: [
      { ...g.match.players[0], group: 'stripes' },
      { ...g.match.players[1], group: 'solids' },
    ],
  };
  return g;
}

function playShot(g: GameController, d: Difficulty, rng: () => number) {
  const s = chooseAIShot(g, d, rng);
  if (s.cuePos) g.placeCue(s.cuePos.x, s.cuePos.y);
  if (g.needsCall()) g.callPocket(s.calledPocket ?? 0);
  const ok = g.shoot(s.angle, s.power);
  while (g.phase === 'rolling') g.tick();
  return { s, ok };
}

describe('IA', () => {
  it('candidatas sempre miram bolas legalmente jogáveis', () => {
    const g = scenario();
    const cands = potCandidates(g.world, g.match);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) expect(groupBalls('solids')).toContain(c.target);
  });

  it('a jogada escolhida toca primeiro uma bola legal (todas as dificuldades)', () => {
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const g = scenario();
      const { ok } = playShot(g, d, makeRng(7));
      expect(ok).toBe(true);
      const foul = g.lastResult!.foul ?? '';
      expect(foul).not.toMatch(/adversário|tocou a bola 8|não tocou/);
    }
  });

  it('dificuldade importa: Difícil encaçapa mais que Fácil no mesmo cenário', () => {
    const rate = (d: Difficulty) => {
      let ok = 0;
      const N = 30;
      for (let i = 0; i < N; i++) {
        const g = scenario();
        playShot(g, d, makeRng(100 + i));
        if (g.lastResult!.continued) ok++;
      }
      return ok / N;
    };
    const easy = rate('easy');
    const hard = rate('hard');
    expect(hard).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThanOrEqual(0.6);
  });

  it('ao ter bola na mão, a IA posiciona a branca em local válido', () => {
    const g = scenario();
    g.match = { ...g.match, ballInHand: 'anywhere' };
    const s = chooseAIShot(g, 'medium', makeRng(3));
    expect(s.cuePos).not.toBeNull();
    expect(g.placeCue(s.cuePos!.x, s.cuePos!.y)).toBe(true);
  });

  it('decide rápido (orçamento de tempo por jogada)', () => {
    const g = scenario();
    const t0 = performance.now();
    chooseAIShot(g, 'hard', makeRng(1));
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
    it(`partida completa IA×IA (${d}) termina com vencedor e sem tacadas recusadas`, () => {
      const g = new GameController({ mode: 'local' });
      const rng = makeRng(42);
      let shots = 0;
      while (g.match.winner === null && shots < 400) {
        const { ok } = playShot(g, d, rng);
        expect(ok).toBe(true);
        shots++;
      }
      expect(g.match.winner).not.toBeNull();
      expect(getBall(g.world, 0)!.pocketed).toBe(false);
    }, 120_000);
  }
});
