// Fuzz da física dos obstáculos móveis do minigolfe (buracos com moinho/portão).
// Milhares de tacadas aleatórias; conta: fora de campo indevido, bola dentro de parede/bloco, bola parada
// que o obstáculo atravessaria depois, tacadas que estouram o tempo (bola presa) e bola holed.
// Uso: npx vite-node scripts/golfe-moveis.ts [n]
import { LEVELS } from '../src/games/minigolf/levels/levels';
import { createWorld, strike, step, moverSegments, pointInPoly, inMoverSweep } from '../src/games/minigolf/physics/sim';
import { GOLF, Level, Vec } from '../src/games/minigolf/physics/types';

const N = Number(process.argv[2] ?? 4000);
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const R = GOLF.ballR;
function dSeg(p: Vec, a: Vec, b: Vec) {
  const ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
  let t = l2 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - ex * t, p.y - a.y - ey * t);
}
const inStatic = (L: Level, p: Vec) => L.walls.some((w) => dSeg(p, w.a, w.b) < R + w.r - 0.05) || L.blocks.some((bk) => pointInPoly(p, bk));
const hitByMoverLater = (L: Level, p: Vec, t: number) => {
  for (let k = 0; k < 600; k++) for (const m of L.movers) for (const s of moverSegments(m, t + k / 60)) if (dSeg(p, s.a, s.b) < R + s.r - 0.05) return true;
  return false;
};
function randomPointOnGreen(L: Level): Vec {
  for (;;) {
    const p = { x: L.bounds.x + rnd() * L.bounds.w, y: L.bounds.y + rnd() * L.bounds.h };
    if (pointInPoly(p, L.green) && !inStatic(L, p) && !L.zones.some((z) => z.kind === 'water' && pointInPoly(p, z.poly))) {
      // só pontos onde a bola pode estar parada de verdade (o jogo nunca deixa a bola parada na área varrida)
      if (!inMoverSweep(L, p, R)) return p;
    }
  }
}
for (const L of LEVELS.filter((l) => l.movers.length)) {
  const hasOpen = (L.openEdges?.length ?? 0) > 0 || L.zones.some((z) => z.kind === 'water');
  const c = { out: 0, outBad: 0, penetr: 0, restInside: 0, restSwept: 0, timeout: 0, holed: 0, maxV: 0 };
  const ex: string[] = [];
  for (let i = 0; i < N; i++) {
    // metade das tacadas sai de perto do obstáculo (onde os problemas aparecem)
    const near = i % 2 === 0;
    let from = randomPointOnGreen(L);
    if (near) {
      const m = L.movers[0];
      const cx = m.kind === 'rotor' ? m.center.x : m.x + m.w / 2;
      const cy = m.kind === 'rotor' ? m.center.y : m.y + m.h / 2;
      for (let k = 0; k < 50; k++) { const p = randomPointOnGreen(L); if (Math.hypot(p.x - cx, p.y - cy) < 12) { from = p; break; } }
    }
    const t0 = rnd() * 20;
    const w = createWorld(L, from, t0);
    strike(w, rnd() * Math.PI * 2, 0.05 + rnd() * 0.95);
    let pen = false;
    let g = 0;
    while (w.status === 'moving' && g++ < 1e5) {
      step(w);
      const v = Math.hypot(w.vx, w.vy);
      if (v > c.maxV) c.maxV = v;
      if (!pen && w.status === 'moving' && inStatic(L, w)) pen = true;
    }
    if (pen) c.penetr++;
    if (w.status === 'out') { c.out++; if (!hasOpen) { c.outBad++; if (ex.length < 4) ex.push(`out indevido de (${from.x.toFixed(1)},${from.y.toFixed(1)}) t0=${t0.toFixed(2)} → (${w.x.toFixed(1)},${w.y.toFixed(1)})`); } }
    if (w.status === 'holed') c.holed++;
    if (w.shotTime > GOLF.maxShotSeconds) c.timeout++;
    if (w.status === 'rest') {
      if (inStatic(L, w) || !pointInPoly(w, L.green)) { c.restInside++; if (ex.length < 8) ex.push(`parou dentro de parede/bloco em (${w.x.toFixed(2)},${w.y.toFixed(2)})`); }
      if (hitByMoverLater(L, w, w.t)) { c.restSwept++; if (ex.length < 8) ex.push(`parada em (${w.x.toFixed(2)},${w.y.toFixed(2)}) seria atravessada pelo obstáculo`); }
    }
  }
  console.log(`Buraco ${L.id} ${L.name}: ${N} tacadas | fora: ${c.out} (indevido ${c.outBad}) | atravessou parede: ${c.penetr} | parou dentro de parede: ${c.restInside} | parada atravessada depois: ${c.restSwept} | presa (tempo esgotado): ${c.timeout} | caiu no buraco: ${c.holed} | vel. máx ${c.maxV.toFixed(1)}`);
  for (const e of ex) console.log('   ', e);
}
