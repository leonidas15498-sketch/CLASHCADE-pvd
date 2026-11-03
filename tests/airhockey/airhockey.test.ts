import { describe, expect, it } from 'vitest';
import { HockeyAI } from '../../src/games/airhockey/ai';
import { AH, clampMallet, createState, HockeyState, MALLET_R, PUCK_R, setTarget, step, TABLE } from '../../src/games/airhockey/physics';
import { makeRng } from '../../src/games/pool/ai/ai';
import { attackRate, benchHockey, defenseRate } from '../bench/hockey';

const run = (s: HockeyState, secs: number) => {
  for (let i = 0; i < secs / AH.dt; i++) step(s);
};

describe('air hockey — física', () => {
  it('disco quica nas laterais sem sair da mesa e perde pouca velocidade', () => {
    const s = createState();
    s.puck = { x: 1, y: 0.5, vx: 0.5, vy: 3, px: 1, py: 0.5 };
    let minY = 1;
    let maxY = 0;
    for (let i = 0; i < 600; i++) {
      step(s);
      minY = Math.min(minY, s.puck.y);
      maxY = Math.max(maxY, s.puck.y);
    }
    expect(minY).toBeGreaterThanOrEqual(PUCK_R - 1e-9);
    expect(maxY).toBeLessThanOrEqual(TABLE.h - PUCK_R + 1e-9);
    expect(s.events.some((e) => e.type === 'wall')).toBe(true);
  });

  it('gol só quando o disco passa inteiro pela boca; fora da boca rebate', () => {
    const s = createState();
    s.mallets[0].tx = s.mallets[0].x = 0.4;
    s.mallets[0].ty = s.mallets[0].y = 0.1;
    s.puck = { x: 0.5, y: 0.5, vx: -4, vy: 0, px: 0.5, py: 0.5 };
    run(s, 0.5);
    expect(s.score).toEqual([0, 1]);
    const t = createState();
    t.mallets[0].ty = t.mallets[0].y = 0.9;
    t.puck = { x: 0.5, y: 0.1, vx: -4, vy: 0, px: 0.5, py: 0.1 };
    run(t, 0.4);
    expect(t.score).toEqual([0, 0]);
    expect(t.puck.vx).toBeGreaterThan(0);
  });

  it('rebatedor em movimento acelera o disco (velocidade relativa)', () => {
    const s = createState();
    s.puck = { x: 0.6, y: 0.5, vx: 0, vy: 0, px: 0.6, py: 0.5 };
    s.mallets[0].x = s.mallets[0].tx = 0.3;
    setTarget(s, 0, 0.9, 0.5);
    run(s, 0.1);
    expect(s.puck.vx).toBeGreaterThan(3);
    expect(s.events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('velocidade máxima do disco é respeitada e não atravessa o rebatedor', () => {
    const s = createState();
    s.mallets[0].x = s.mallets[0].tx = 0.3;
    s.mallets[0].y = s.mallets[0].ty = 0.5;
    s.puck = { x: 0.8, y: 0.5, vx: -50, vy: 0, px: 0.8, py: 0.5 };
    step(s);
    expect(Math.hypot(s.puck.vx, s.puck.vy)).toBeLessThanOrEqual(AH.maxPuckSpeed + 1e-6);
    for (let i = 0; i < 100; i++) {
      step(s);
      expect(Math.hypot(s.puck.x - s.mallets[0].x, s.puck.y - s.mallets[0].y)).toBeGreaterThanOrEqual(PUCK_R + MALLET_R - 1e-6);
    }
  });

  it('cada rebatedor fica no próprio campo', () => {
    expect(clampMallet(0, 1.8, 0.5).x).toBeLessThanOrEqual(TABLE.w / 2 - MALLET_R);
    expect(clampMallet(1, 0.1, -3)).toEqual({ x: TABLE.w / 2 + MALLET_R, y: MALLET_R });
  });

  it('a partida termina em 7 gols', () => {
    const s = createState();
    for (let g = 0; g < 7; g++) {
      s.freeze = 0;
      s.puck = { x: 0.5, y: 0.5, vx: -5, vy: 0, px: 0.5, py: 0.5 };
      s.mallets[0].x = s.mallets[0].tx = 0.5;
      s.mallets[0].y = s.mallets[0].ty = 0.1;
      run(s, 0.4);
    }
    expect(s.score[1]).toBe(7);
    expect(s.winner).toBe(1);
  });
});

describe('air hockey — IA', () => {
  // Pedido do Leon (01/11): o Fácil estava ganhando dele. Níveis medidos contra um "humano médio" de referência.
  it('defesas: Fácil defende bem menos que Médio e Difícil', () => {
    const e = defenseRate('easy');
    const m = defenseRate('medium');
    const h = defenseRate('hard');
    expect(m).toBeGreaterThan(e + 0.25);
    expect(h).toBeGreaterThanOrEqual(m);
    expect(e).toBeLessThan(0.65);
  });

  it('partidas contra a referência: Fácil < Médio < Difícil, com folga', () => {
    const b = benchHockey(90, 8);
    expect(b.easy.share).toBeLessThan(0.3);
    expect(b.medium.share).toBeGreaterThan(b.easy.share + 0.12);
    expect(b.hard.share).toBeGreaterThan(b.medium.share + 0.12);
    expect(b.hard.share).toBeGreaterThan(0.5);
  }, 60_000);

  it('Fácil ataca fraco; Difícil ataca forte', () => {
    expect(attackRate('easy', 80).shotSpeed).toBeLessThan(attackRate('hard', 80).shotSpeed - 1);
  });

  it('o rebatedor da IA nunca sai do próprio campo', () => {
    const s = createState();
    const ai = new HockeyAI('hard', makeRng(3));
    s.puck = { x: 1.2, y: 0.3, vx: -3, vy: 2, px: 1.2, py: 0.3 };
    for (let k = 0; k < 5 / AH.dt; k++) {
      ai.update(s, AH.dt);
      step(s);
      expect(s.mallets[1].x).toBeGreaterThanOrEqual(TABLE.w / 2 + MALLET_R - 1e-9);
    }
  });

  it('partida IA × IA termina com vencedor', () => {
    const s = createState();
    const a = new HockeyAI('hard', makeRng(1));
    const b = new HockeyAI('medium', makeRng(2));
    // espelho para a IA jogar pelo lado esquerdo
    for (let i = 0; i < 300 / AH.dt && s.winner === null; i++) {
      a.update(s, AH.dt);
      const m = { ...s, puck: { ...s.puck, x: TABLE.w - s.puck.x, vx: -s.puck.vx }, mallets: [s.mallets[1], { ...s.mallets[0], x: TABLE.w - s.mallets[0].x, tx: TABLE.w - s.mallets[0].tx }] } as HockeyState;
      b.update(m, AH.dt);
      const t = m.mallets[1];
      setTarget(s, 0, TABLE.w - t.tx, t.ty);
      step(s);
    }
    expect(s.winner).not.toBeNull();
  }, 60000);
});
