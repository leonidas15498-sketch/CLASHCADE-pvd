import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/games/pool/game/controller';
import { applyState, encodeState, parsePoolState, PoolNetState } from '../../src/games/pool/online';
import { timeoutFoul } from '../../src/games/pool/rules/rules';

const names: [string, string] = ['Ana', 'Bia'];
/** Joga até a mesa parar e devolve o pacote que iria para a rede (ida e volta em JSON, como no Supabase). */
function shootAndPack(g: GameController, angle: number, power: number, spin = { side: 0, top: 0 }): PoolNetState {
  expect(g.shoot(angle, power, spin)).toBe(true);
  let guard = 0;
  while (g.phase === 'rolling' && guard++ < 120 * 60) g.tick();
  return JSON.parse(JSON.stringify(encodeState(g, g.lastShot)));
}
function replay(g: GameController, s: PoolNetState) {
  g.replayShot(s.shot!);
  let guard = 0;
  while (g.phase === 'rolling' && guard++ < 120 * 60) g.tick();
}

describe('Sinuca online: estado e repetição da tacada', () => {
  it('o outro aparelho repete a abertura e chega exatamente às mesmas posições', () => {
    const a = new GameController({ mode: 'local', names });
    const b = new GameController({ mode: 'local', names });
    const pack = shootAndPack(a, 0.01, 1, { side: 0.2, top: -0.3 });
    expect(parsePoolState(pack)).not.toBeNull();
    replay(b, pack);
    for (const ball of a.world.balls) {
      const o = b.world.balls.find((x) => x.id === ball.id)!;
      expect([o.x, o.y, o.pocketed]).toEqual([ball.x, ball.y, ball.pocketed]);
    }
    applyState(b, pack, names);
    expect(b.match.current).toBe(a.match.current);
    expect(b.match.ballInHand).toBe(a.match.ballInHand);
    expect(b.pocketOrder).toEqual(a.pocketOrder);
  });

  it('várias tacadas seguidas continuam em sincronia (estado aplicado = estado de quem tacou)', () => {
    const a = new GameController({ mode: 'local', names });
    const b = new GameController({ mode: 'local', names });
    const angles = [0.02, 2.4, -1.1, 0.7, 3.0, -2.2];
    for (const ang of angles) {
      if (a.match.winner !== null) break;
      if (a.match.ballInHand !== 'none') a.placeCue(a.cue.x, a.cue.y);
      if (a.needsCall()) a.callPocket(0);
      const pack = shootAndPack(a, ang, 0.6);
      replay(b, pack);
      applyState(b, pack, names);
      expect(JSON.stringify(encodeState(b, null).balls)).toBe(JSON.stringify(pack.balls));
      expect(b.match.current).toBe(pack.match.current);
      expect(b.match.players.map((p) => p.group)).toEqual(pack.match.groups);
    }
  });

  it('tempo esgotado vira pacote sem tacada que passa a vez', () => {
    const g = new GameController({ mode: 'local', names });
    g.match = timeoutFoul(g.match);
    const pack = JSON.parse(JSON.stringify(encodeState(g, null)));
    const parsed = parsePoolState(pack)!;
    expect(parsed.shot).toBeNull();
    expect(parsed.match.current).toBe(1);
    expect(parsed.match.ballInHand).toBe('kitchen');
  });

  it('recusa pacotes malformados', () => {
    const g = new GameController({ mode: 'local', names });
    const ok = JSON.parse(JSON.stringify(encodeState(g, null)));
    expect(parsePoolState(ok)).not.toBeNull();
    const bad = (f: (s: PoolNetState) => void) => { const s = structuredClone(ok); f(s); return parsePoolState(s); };
    expect(bad((s) => s.balls.pop())).toBeNull();
    expect(bad((s) => { s.balls[1].id = 0; })).toBeNull();
    expect(bad((s) => { (s.balls[0] as unknown as { x: string }).x = 'NaN'; })).toBeNull();
    expect(bad((s) => { (s.match as unknown as { current: number }).current = 2; })).toBeNull();
    expect(bad((s) => { s.match.lastMessage = 'x'.repeat(5000); })).toBeNull();
    expect(bad((s) => { s.shot = { from: s.balls, cue: [99, 0, 0, 0, 0] }; })).toBeNull();
    expect(parsePoolState(null)).toBeNull();
  });
});
