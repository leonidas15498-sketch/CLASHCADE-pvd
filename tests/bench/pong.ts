/** Medição da IA do Pong contra um "humano médio" simulado (mesmo modelo da IA). Números no STATUS.md. */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { PongAI, PongCfg } from '../../src/games/pong/ai';
import { createPong, PONG, stepPong } from '../../src/games/pong/physics';

/** Referência: reação 0,22 s, 70% da velocidade, mira só às vezes. */
export const PONG_REF: PongCfg = { reaction: 0.22, aimError: 0.05, speedScale: 0.7, lapse: 0.05, recenter: true, aim: 0.2 };

/** % dos pontos feitos pela IA (lado direito) contra a referência, em `secs` segundos de jogo por partida. */
export function pongVsRef(d: Difficulty, n = 8, secs = 120, seed = 1): { share: number; rally: number } {
  let ai = 0;
  let ref = 0;
  let hits = 0;
  let points = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 19 + i);
    const s = createPong((i % 2) as 0 | 1, rng);
    const a = new PongAI(d, makeRng(seed * 7 + i), 1);
    const r = new PongAI('medium', makeRng(seed * 11 + i), 0, PONG_REF);
    for (let k = 0; k < secs / PONG.dt; k++) {
      a.update(s, PONG.dt);
      r.update(s, PONG.dt);
      s.events.length = 0;
      stepPong(s, rng);
      for (const e of s.events) {
        if (e.type === 'hit') hits++;
        if (e.type === 'point') points++;
      }
      if (s.winner !== null) s.winner = null;
    }
    ai += s.score[1];
    ref += s.score[0];
  }
  return { share: ai / (ai + ref || 1), rally: hits / (points || 1) };
}
