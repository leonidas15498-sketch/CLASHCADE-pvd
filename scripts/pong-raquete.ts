/** Varredura do tamanho da raquete do Pong: robôs "humanos" × robôs, e IA × humano médio. Rodar: npx vite-node scripts/pong-raquete.ts */
import { makeRng } from '../src/games/pool/ai/ai';
import { PongAI, PongCfg } from '../src/games/pong/ai';
import { createPong, PONG, stepPong } from '../src/games/pong/physics';
import { PONG_REF } from '../tests/bench/pong';

const CASUAL: PongCfg = { reaction: 0.3, aimError: 0.09, speedScale: 0.65, lapse: 0.08, recenter: true, aim: 0.1 };
const sizes = [0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24];

function match(cfgA: PongCfg | 'easy' | 'medium' | 'hard', cfgB: PongCfg, seed: number) {
  const rng = makeRng(seed);
  const s = createPong((seed % 2) as 0 | 1, rng);
  const a = typeof cfgA === 'string' ? new PongAI(cfgA, makeRng(seed * 7), 1) : new PongAI('medium', makeRng(seed * 7), 1, cfgA);
  const b = new PongAI('medium', makeRng(seed * 11), 0, cfgB);
  let hits = 0, points = 0, maxRally = 0;
  while (s.winner === null && s.t < 900) {
    a.update(s, PONG.dt); b.update(s, PONG.dt);
    s.events.length = 0; stepPong(s, rng);
    for (const e of s.events) { if (e.type === 'hit') hits++; if (e.type === 'point') { points++; } }
    maxRally = Math.max(maxRally, s.rally);
  }
  return { t: s.t, hits, points, maxRally, aiPts: s.score[1], refPts: s.score[0] };
}

const N = 60;
console.log('tam(cm) | humano×humano médio: rebat/ponto, s/ponto, min/partida, maior troca | casual×casual: rebat/ponto, min/partida | IA % pontos F/M/D');
for (const h of sizes) {
  PONG.paddleH = h;
  const agg = (fn: (i: number) => ReturnType<typeof match>) => {
    let t = 0, hits = 0, pts = 0, mx = 0, ai = 0, ref = 0;
    for (let i = 1; i <= N; i++) { const r = fn(i); t += r.t; hits += r.hits; pts += r.points; mx = Math.max(mx, r.maxRally); ai += r.aiPts; ref += r.refPts; }
    return { rally: hits / pts, sPt: t / pts, min: t / N / 60, mx, share: ai / (ai + ref) };
  };
  const hh = agg((i) => match(PONG_REF, PONG_REF, i));
  const cc = agg((i) => match(CASUAL, CASUAL, i + 500));
  const ia = (['easy', 'medium', 'hard'] as const).map((d) => Math.round(agg((i) => match(d, PONG_REF, i + 900)).share * 100));
  console.log(`${(h * 100).toFixed(0).padStart(3)} | ${hh.rally.toFixed(1)} rb, ${hh.sPt.toFixed(1)} s, ${hh.min.toFixed(1)} min, máx ${hh.mx} | ${cc.rally.toFixed(1)} rb, ${cc.min.toFixed(1)} min | ${ia.join('/')}`);
}
// Pior caso físico: bola na velocidade máxima e ângulo máximo, de uma ponta à outra
const vx = PONG.maxBall * Math.cos(PONG.maxAngle);
const travel = 2 - 2 * PONG.paddleX;
const tt = travel / vx;
console.log(`Pior caso: bola ${PONG.maxBall} m/s a ${(PONG.maxAngle * 180 / Math.PI).toFixed(0)}° leva ${tt.toFixed(2)} s; com reação 0,25 s a raquete anda ${(PONG.maxPaddle * (tt - 0.25)).toFixed(2)} m (mesa 1,0 m)`);
