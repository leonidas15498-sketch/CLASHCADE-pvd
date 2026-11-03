import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/games/pool/game/controller';
import { aimRaycast, objectBallPath } from '../../src/games/pool/physics/raycast';

/** Mesa com só a branca e uma bola; devolve o controlador pronto para mirar. */
function setup(bx: number, by: number, cx: number, cy: number) {
  const g = new GameController({ mode: 'local', names: ['A', 'B'] });
  for (const b of g.world.balls) {
    if (b.id === 0) { b.x = b.px = cx; b.y = b.py = cy; }
    else if (b.id === 3) { b.x = b.px = bx; b.y = b.py = by; }
    else { b.pocketed = true; b.x = b.px = -5; b.y = b.py = -5; }
  }
  return g;
}

describe('Sinuca: linha guia da bola atingida', () => {
  for (const [label, angle, spin] of [
    ['reta', 0, { side: 0, top: 0 }],
    ['corte fino com efeito', 0.06, { side: 0.6, top: -0.5 }],
    ['corte médio com efeito alto', -0.03, { side: -0.4, top: 0.6 }],
  ] as const) {
    it(`a bola sai na direção mostrada (${label})`, () => {
      const g = setup(1.6, 0.62, 0.9, 0.635);
      const aim = aimRaycast(g.world, angle);
      expect(aim.kind).toBe('ball');
      const path = objectBallPath(g.world, aim)!;
      expect(path).not.toBeNull();
      g.match = { ...g.match, isBreak: false, ballInHand: 'none' };
      expect(g.shoot(angle, 0.5, spin)).toBe(true);
      const ball = g.world.balls.find((b) => b.id === 3)!;
      // anda até a bola 3 se mover um pouco e mede a direção do deslocamento
      for (let i = 0; i < 2000 && Math.hypot(ball.x - 1.6, ball.y - 0.62) < 0.05; i++) g.tick();
      const dx = ball.x - 1.6, dy = ball.y - 0.62;
      const L = Math.hypot(dx, dy);
      expect(L).toBeGreaterThan(0.04);
      const cos = (dx * path.dir.x + dy * path.dir.y) / L;
      expect(Math.acos(Math.min(1, cos)) * 180 / Math.PI).toBeLessThan(0.1); // menos de 0,1 grau
      expect(['cushion', 'pocket']).toContain(path.hit.kind);
    });
  }

  it('sem bola na mira não há linha guia', () => {
    const g = setup(1.6, 0.62, 0.9, 0.635);
    expect(objectBallPath(g.world, aimRaycast(g.world, Math.PI))).toBeNull();
  });
});
