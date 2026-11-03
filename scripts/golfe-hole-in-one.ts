/**
 * Teste de hole in one: para cada buraco, varre ângulo × força a partir do tee e procura tacadas que caem de primeira.
 * Rodar: npx vite-node scripts/golfe-hole-in-one.ts [passoGraus=1] [passoForça=0.02]
 * "Janela" = quantas tacadas vizinhas também caem (medida de quão realista é acertar com o dedo).
 */
import { LEVELS } from '../src/games/minigolf/levels/levels';
import { simulateShot } from '../src/games/minigolf/physics/sim';

const aStep = Number(process.argv[2] ?? 1);
const pStep = Number(process.argv[3] ?? 0.02);
const only = process.argv[4] ? Number(process.argv[4]) : null;
const t0s = (lv: (typeof LEVELS)[number]) => (lv.movers.length ? [0, 0.7, 1.4, 2.1, 2.8, 3.5] : [0]);

for (const lv of LEVELS) {
  if (only && lv.id !== only) continue;
  const t = Date.now();
  let hits = 0;
  let total = 0;
  const found: Array<{ deg: number; p: number; t0: number }> = [];
  for (const t0 of t0s(lv)) {
    for (let deg = 0; deg < 360; deg += aStep) {
      for (let p = pStep; p <= 1.0001; p += pStep) {
        total++;
        const r = simulateShot(lv, lv.tee, t0, (deg * Math.PI) / 180, p);
        if (r.status === 'holed') {
          hits++;
          found.push({ deg, p: +p.toFixed(3), t0 });
        }
      }
    }
  }
  // janela: para o melhor acerto, quantos vizinhos (±1 passo de ângulo × ±2 de força) também caem
  let best = '';
  let bestN = -1;
  for (const f of found.slice(0, 400)) {
    let n = 0;
    for (const da of [-aStep / 2, 0, aStep / 2]) for (const dp of [-pStep, -pStep / 2, 0, pStep / 2, pStep]) {
      if (simulateShot(lv, lv.tee, f.t0, ((f.deg + da) * Math.PI) / 180, f.p + dp).status === 'holed') n++;
    }
    if (n > bestN) {
      bestN = n;
      best = `${f.deg}° força ${(f.p * 100).toFixed(0)}% t0 ${f.t0}`;
    }
  }
  console.log(`buraco ${lv.id} ${lv.name.padEnd(18)} par ${lv.par}: ${hits}/${total} tacadas caem de primeira (${((hits / total) * 100).toFixed(2)}%)${hits ? ` | melhor: ${best}, vizinhos que caem ${bestN}/15` : ' | SEM HOLE IN ONE'} [${((Date.now() - t) / 1000).toFixed(0)} s]`);
}
