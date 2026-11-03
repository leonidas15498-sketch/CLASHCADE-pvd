/**
 * Medição da IA do Air Hockey (usada pelos testes e por scripts/bench.ts).
 * Referência = bot que imita um "humano médio" no celular (REF). Números registrados no STATUS.md.
 */
import { Cfg, HockeyAI } from '../../src/games/airhockey/ai';
import { AH, createState, HockeyState, setTarget, step, TABLE } from '../../src/games/airhockey/physics';
import { makeRng } from '../../src/games/pool/ai/ai';

export type D = 'easy' | 'medium' | 'hard';
function mirror(s: HockeyState): HockeyState {
  return {
    ...s,
    puck: { ...s.puck, x: TABLE.w - s.puck.x, vx: -s.puck.vx },
    mallets: [s.mallets[1], { ...s.mallets[0], x: TABLE.w - s.mallets[0].x, tx: TABLE.w - s.mallets[0].tx, vx: -s.mallets[0].vx }],
  } as HockeyState;
}

export function playVsRef(d: D, refCfg: Cfg, seed: number, secs = 180) {
  const s = createState();
  const ai = new HockeyAI(d, makeRng(seed));
  const ref = new HockeyAI('medium', makeRng(seed + 999), refCfg);
  for (let i = 0; i < secs / AH.dt; i++) {
    ai.update(s, AH.dt);
    const m = mirror(s);
    ref.update(m, AH.dt);
    const t = m.mallets[1];
    setTarget(s, 0, TABLE.w - t.tx, t.ty);
    s.events.length = 0;
    step(s);
    if (s.winner !== null) s.winner = null; // continua contando gols para medir a taxa por minuto
  }
  return { aiGoals: s.score[1], refGoals: s.score[0], mins: secs / 60 };
}

/** "Humano médio" de referência: reação ~0,2 s, mira razoável, sem tabelas. */
export const REF: Cfg = { reaction: 0.25, aimError: 0.08, speedScale: 0.6, strikeScale: 0.8, shotError: 0.12, bankShots: false, lapse: 0.05, lead: 0.6, homeDist: 0.2, track: 0.5, smartAim: false };
export function benchHockey(secs = 120, n = 10) {
  const out: Record<string, { aiPerMin: number; refPerMin: number; share: number }> = {};
  for (const d of ['easy', 'medium', 'hard'] as D[]) {
    let a = 0, r = 0, m = 0;
    for (let k = 0; k < n; k++) {
      const o = playVsRef(d, REF, 10 + k, secs);
      a += o.aiGoals; r += o.refGoals; m += o.mins;
    }
    out[d] = { aiPerMin: a / m, refPerMin: r / m, share: a / (a + r || 1) };
  }
  return out;
}
/** % de defesas: chutes de perto do meio da mesa (diretos e com tabela), 4,5–5,5 m/s, mirando dentro do gol. */
export function defenseRate(d: D, n = 200, seed = 5, cfg?: Cfg): number {
  const rng = makeRng(seed);
  let saved = 0;
  for (let i = 0; i < n; i++) {
    const s = createState();
    const ai = new HockeyAI(d, makeRng(seed * 31 + i), cfg);
    // rebatedor da IA começa em posição de defesa variada (ex.: voltando de um ataque)
    s.mallets[1].x = s.mallets[1].tx = 1.55 + rng() * 0.3;
    s.mallets[1].y = s.mallets[1].ty = 0.25 + rng() * 0.5;
    const x0 = 0.6 + rng() * 0.4;
    const y0 = 0.1 + rng() * 0.8;
    const gy = 0.5 + (rng() - 0.5) * (TABLE.goal - 0.1);
    const bank = rng() < 0.3;
    const ty = bank ? (rng() < 0.5 ? -gy : 2 - gy) : gy; // tabela = mira no reflexo
    const v = 4.5 + rng() * 1;
    const dx = TABLE.w - x0;
    const dy = ty - y0;
    const dd = Math.hypot(dx, dy);
    s.puck = { x: x0, y: y0, vx: (dx / dd) * v, vy: (dy / dd) * v, px: x0, py: y0 };
    s.mallets[0].x = s.mallets[0].tx = 0.1;
    s.mallets[0].y = s.mallets[0].ty = 0.08;
    for (let k = 0; k < 1.6 / AH.dt; k++) {
      ai.update(s, AH.dt);
      step(s);
      if (s.score[0] > 0) break;
    }
    if (s.score[0] === 0) saved++;
  }
  return saved / n;
}

/** Ataque: disco solto devagar no campo da IA, contra um goleiro de referência. % que vira gol em 3 s e força média da tacada. */
export function attackRate(d: D, n = 200, seed = 9): { goals: number; shotSpeed: number } {
  const rng = makeRng(seed);
  let goals = 0;
  let spSum = 0;
  let spN = 0;
  for (let i = 0; i < n; i++) {
    const s = createState();
    const ai = new HockeyAI(d, makeRng(seed * 17 + i));
    const ref = new HockeyAI('medium', makeRng(seed * 13 + i), REF);
    const x0 = 1.2 + rng() * 0.6;
    const y0 = 0.12 + rng() * 0.76;
    s.puck = { x: x0, y: y0, vx: (rng() - 0.5) * 0.8, vy: (rng() - 0.5) * 0.8, px: x0, py: y0 };
    s.mallets[1].x = s.mallets[1].tx = 1.83;
    s.mallets[1].y = s.mallets[1].ty = 0.5;
    let hit = false;
    for (let k = 0; k < 3 / AH.dt; k++) {
      ai.update(s, AH.dt);
      const m = mirror(s);
      if (s.puck.x < TABLE.w / 2 || hit) {
        ref.update(m, AH.dt);
        const t = m.mallets[1];
        setTarget(s, 0, TABLE.w - t.tx, t.ty);
      }
      s.events.length = 0;
      step(s);
      for (const e of s.events) if (e.type === 'hit' && e.player === 1 && !hit) {
        hit = true;
        spSum += Math.hypot(s.puck.vx, s.puck.vy);
        spN++;
      }
      if (s.score[1] > 0) { goals++; break; }
      if (s.score[0] > 0) break;
    }
  }
  return { goals: goals / n, shotSpeed: spSum / (spN || 1) };
}

