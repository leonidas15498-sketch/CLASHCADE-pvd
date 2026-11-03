import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/games/pool/game/controller';
import { getBall } from '../../src/games/pool/physics/world';
import { createMatch, evaluateShot, MatchState, ShotSummary } from '../../src/games/pool/rules/rules';

const ALL = Array.from({ length: 16 }, (_, i) => i);
const sum = (p: Partial<ShotSummary>): ShotSummary => ({
  firstContact: 1,
  pocketed: [],
  railAfterContact: true,
  objectBallsToRail: 0,
  cueScratch: false,
  ...p,
});
function midGame(over: Partial<MatchState> = {}): MatchState {
  const m = createMatch({ mode: 'local' });
  return {
    ...m,
    isBreak: false,
    tableOpen: false,
    ballInHand: 'none',
    players: [
      { ...m.players[0], group: 'solids' },
      { ...m.players[1], group: 'stripes' },
    ],
    ...over,
  };
}

describe('regras 8-ball (variante documentada em RULES.md)', () => {
  it('abertura legal com bola encaçapada mantém a vez e a mesa aberta', () => {
    const m = createMatch({ mode: 'local' });
    const r = evaluateShot(m, sum({ pocketed: [{ ball: 3, pocket: 0 }] }), ALL);
    expect(r.foul).toBeNull();
    expect(r.state.current).toBe(0);
    expect(r.state.tableOpen).toBe(true);
    expect(r.state.isBreak).toBe(false);
  });

  it('abertura sem bola encaçapada e com < 4 bolas na tabela é falta', () => {
    const m = createMatch({ mode: 'local' });
    const r = evaluateShot(m, sum({ objectBallsToRail: 2 }), ALL);
    expect(r.foul).toMatch(/abertura ilegal/);
    expect(r.state.ballInHand).toBe('anywhere');
    expect(r.state.current).toBe(1);
  });

  it('8 encaçapada na abertura volta ao ponto do pé e não decide a partida', () => {
    const m = createMatch({ mode: 'local' });
    const r = evaluateShot(m, sum({ pocketed: [{ ball: 8, pocket: 5 }] }), ALL);
    expect(r.respotEight).toBe(true);
    expect(r.state.winner).toBeNull();
    expect(r.state.current).toBe(0);
  });

  it('mesa aberta: primeira bola encaçapada define os grupos', () => {
    const m = midGame({ tableOpen: true, players: [{ name: 'A', isAI: false, group: null }, { name: 'B', isAI: false, group: null }] });
    const r = evaluateShot(m, sum({ firstContact: 12, pocketed: [{ ball: 12, pocket: 2 }] }), ALL);
    expect(r.state.players[0].group).toBe('stripes');
    expect(r.state.players[1].group).toBe('solids');
    expect(r.state.tableOpen).toBe(false);
    expect(r.state.current).toBe(0);
  });

  it('mesa aberta: tocar a 8 primeiro é falta', () => {
    const m = midGame({ tableOpen: true, players: [{ name: 'A', isAI: false, group: null }, { name: 'B', isAI: false, group: null }] });
    const r = evaluateShot(m, sum({ firstContact: 8 }), ALL);
    expect(r.foul).not.toBeNull();
  });

  it('falta: bola branca encaçapada -> bola na mão para o adversário', () => {
    const r = evaluateShot(midGame(), sum({ firstContact: 2, cueScratch: true, pocketed: [{ ball: 0, pocket: 3 }] }), ALL);
    expect(r.foul).toMatch(/branca/);
    expect(r.state.current).toBe(1);
    expect(r.state.ballInHand).toBe('anywhere');
  });

  it('falta: tocar primeiro uma bola do grupo adversário (mesmo encaçapando a sua)', () => {
    const r = evaluateShot(midGame(), sum({ firstContact: 11, pocketed: [{ ball: 2, pocket: 1 }] }), ALL);
    expect(r.foul).toMatch(/adversário/);
    expect(r.state.current).toBe(1);
  });

  it('falta: nenhuma bola na tabela após o contato', () => {
    const r = evaluateShot(midGame(), sum({ firstContact: 2, railAfterContact: false }), ALL);
    expect(r.foul).toMatch(/tabela/);
  });

  it('falta: a branca não toca nenhuma bola', () => {
    const r = evaluateShot(midGame(), sum({ firstContact: null }), ALL);
    expect(r.foul).toMatch(/não tocou/);
  });

  it('encaçapar bola do próprio grupo mantém a vez; errar passa a vez', () => {
    expect(evaluateShot(midGame(), sum({ firstContact: 2, pocketed: [{ ball: 2, pocket: 0 }] }), ALL).state.current).toBe(0);
    expect(evaluateShot(midGame(), sum({ firstContact: 2 }), ALL).state.current).toBe(1);
  });

  it('bola 8 antes de terminar o grupo = derrota', () => {
    const r = evaluateShot(midGame(), sum({ firstContact: 2, pocketed: [{ ball: 8, pocket: 0 }] }), ALL);
    expect(r.state.winner).toBe(1);
  });

  const onEightTable = [0, 8, 9, 10];
  it('bola 8 na caçapa cantada, sem falta, com o grupo terminado = vitória', () => {
    const m = midGame({ calledPocket: 2 });
    const r = evaluateShot(m, sum({ firstContact: 8, pocketed: [{ ball: 8, pocket: 2 }] }), onEightTable);
    expect(r.state.winner).toBe(0);
  });

  it('bola 8 em caçapa diferente da cantada = derrota', () => {
    const m = midGame({ calledPocket: 2 });
    const r = evaluateShot(m, sum({ firstContact: 8, pocketed: [{ ball: 8, pocket: 5 }] }), onEightTable);
    expect(r.state.winner).toBe(1);
  });

  it('bola 8 com branca encaçapada = derrota', () => {
    const m = midGame({ calledPocket: 2 });
    const r = evaluateShot(
      m,
      sum({ firstContact: 8, cueScratch: true, pocketed: [{ ball: 8, pocket: 2 }, { ball: 0, pocket: 0 }] }),
      onEightTable,
    );
    expect(r.state.winner).toBe(1);
  });

  it('na 8: tocar outra bola primeiro é falta', () => {
    const r = evaluateShot(midGame({ calledPocket: 2 }), sum({ firstContact: 9 }), onEightTable);
    expect(r.foul).not.toBeNull();
  });
});

describe('controlador: bola na mão, tacada e reinício', () => {
  it('tempo esgotado é falta: passa a vez com bola na mão (na abertura, o adversário abre)', () => {
    const g = new GameController({ mode: 'local' });
    expect(g.timeout()).toBe(true);
    expect(g.match.current).toBe(1);
    expect(g.match.isBreak).toBe(true);
    expect(g.match.ballInHand).toBe('kitchen');
    expect(g.match.lastFoul).toMatch(/tempo/);
    g.match = { ...midGame(), current: 1 };
    g.timeout();
    expect(g.match.current).toBe(0);
    expect(g.match.ballInHand).toBe('anywhere');
    expect(g.match.calledPocket).toBeNull();
  });

  it('registra a ordem das bolas encaçapadas e zera no reinício', () => {
    const g = new GameController({ mode: 'local' });
    g.match = { ...midGame(), mode: 'local' };
    const b = getBall(g.world, 3)!;
    b.x = b.px = 0.4;
    b.y = b.py = 0.4;
    g.cue.x = 0.6;
    g.cue.y = 0.6;
    const pk = g.world.table.pockets[0];
    // mira a branca na bola 3 alinhada com a caçapa 0
    const ang = Math.atan2(pk.aim.y - 0.4, pk.aim.x - 0.4);
    const R = g.world.params.ballRadius;
    const gx = 0.4 - Math.cos(ang) * 2 * R;
    const gy = 0.4 - Math.sin(ang) * 2 * R;
    g.shoot(Math.atan2(gy - 0.6, gx - 0.6), 0.45);
    while (g.phase === 'rolling') g.tick();
    expect(g.pocketOrder).toContain(3);
    g.reset();
    expect(g.pocketOrder).toEqual([]);
  });

  it('bola na mão não permite sobreposição nem fora da mesa; cozinha limita x na abertura', () => {
    const g = new GameController({ mode: 'local' });
    const one = getBall(g.world, 1)!;
    expect(g.match.ballInHand).toBe('kitchen');
    expect(g.placeCue(one.x, one.y)).toBe(false); // sobre a bola 1 e fora da cozinha
    expect(g.placeCue(1.2, 0.6)).toBe(false); // além da linha de cabeceira
    expect(g.placeCue(-0.1, 0.6)).toBe(false);
    expect(g.placeCue(0.4, 0.4)).toBe(true);
    // em qualquer lugar após falta: rejeita sobreposição, aceita área livre
    g.match = { ...g.match, ballInHand: 'anywhere' };
    expect(g.placeCue(one.x + 0.01, one.y)).toBe(false);
    expect(g.placeCue(1.5, 0.3)).toBe(true);
  });

  it('não permite tacada com bolas em movimento (shoot devolve false)', () => {
    const g = new GameController({ mode: 'local' });
    expect(g.shoot(0, 0.9)).toBe(true);
    g.tick();
    expect(g.shoot(1, 1)).toBe(false);
  });

  it('exige cantar a caçapa quando o jogador está na 8', () => {
    const g = new GameController({ mode: 'local' });
    for (const b of g.world.balls) if (b.id >= 1 && b.id <= 7) b.pocketed = true;
    g.match = { ...midGame(), mode: 'local' };
    expect(g.needsCall()).toBe(true);
    expect(g.canShoot()).toBe(false);
    g.callPocket(2);
    expect(g.canShoot()).toBe(true);
  });

  it('reinício restaura posições, grupos, faltas e turno', () => {
    const g = new GameController({ mode: 'local' });
    g.shoot(0, 1);
    while (g.phase === 'rolling') g.tick();
    g.match = { ...g.match, players: [{ ...g.match.players[0], group: 'solids' }, { ...g.match.players[1], group: 'stripes' }], tableOpen: false, lastFoul: 'x', current: 1 };
    g.reset();
    const fresh = new GameController({ mode: 'local' });
    expect(g.match).toEqual(fresh.match);
    expect(g.world.balls.map((b) => [b.id, b.x, b.y, b.pocketed])).toEqual(fresh.world.balls.map((b) => [b.id, b.x, b.y, b.pocketed]));
    expect(g.phase).toBe('aiming');
  });

  it('branca encaçapada volta à mesa em posição válida', () => {
    const g = new GameController({ mode: 'local' });
    g.match = { ...midGame(), mode: 'local' };
    const pk = g.world.table.pockets[0];
    g.cue.x = 0.5;
    g.cue.y = 0.5;
    g.shoot(Math.atan2(pk.aim.y - 0.5, pk.aim.x - 0.5), 0.3);
    while (g.phase === 'rolling') g.tick();
    expect(g.lastResult!.foul).not.toBeNull();
    expect(g.cue.pocketed).toBe(false);
    expect(g.match.ballInHand).toBe('anywhere');
    expect(g.match.current).toBe(1);
  });
});
