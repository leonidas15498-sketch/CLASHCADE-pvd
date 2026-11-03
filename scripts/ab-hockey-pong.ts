/** A/B pedido no QA de 01/11: Air Hockey 5,5 × 4,5 m/s e Pong raquete 0,18 × 0,21. Rodar: npx vite-node scripts/ab-hockey-pong.ts */
import { AH } from '../src/games/airhockey/physics';
import { PONG } from '../src/games/pong/physics';
import { attackRate, defenseRate, playVsRef, REF } from './../tests/bench/hockey';
import { pongVsRef } from '../tests/bench/pong';
const pct = (x: number) => (100 * x).toFixed(0) + '%';

for (const [puck, mallet] of [[5.5, 5], [4.5, 4.5]]) {
  AH.maxPuckSpeed = puck;
  AH.maxMalletSpeed = mallet;
  const humanDef = defenseRate('medium', 200, 5, REF);
  let line = `AIR HOCKEY disco ${puck} / rebatedor ${mallet} m/s | travessia ${(2 / puck).toFixed(2)} s | humano médio defende ${pct(humanDef)}`;
  for (const d of ['easy', 'medium', 'hard'] as const) {
    let ai = 0, ref = 0, mins = 0;
    for (let i = 0; i < 10; i++) { const r = playVsRef(d, REF, 100 + i, 120); ai += r.aiGoals; ref += r.refGoals; mins += r.mins; }
    const a = attackRate(d);
    line += `\n   ${d.padEnd(6)} IA faz ${pct(ai / (ai + ref))} dos gols | ${((ai + ref) / mins).toFixed(1)} gols/min | defesa IA ${pct(defenseRate(d))} | tacada ${a.shotSpeed.toFixed(1)} m/s`;
  }
  console.log(line);
}
AH.maxPuckSpeed = 5.5;
AH.maxMalletSpeed = 5;

for (const h of [0.18, 0.21]) {
  PONG.paddleH = h;
  const r = (['easy', 'medium', 'hard'] as const).map((d) => pongVsRef(d, 10, 120));
  console.log(`PONG raquete ${h * 100} cm | IA % pontos F/M/D: ${r.map((x) => pct(x.share)).join(' / ')} | rebatidas por ponto: ${r.map((x) => x.rally.toFixed(1)).join(' / ')}`);
}
