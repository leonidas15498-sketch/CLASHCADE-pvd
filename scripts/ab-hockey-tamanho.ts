/** A/B do Air Hockey (03/11): velocidade, raios e gol. Uso: npx vite-node scripts/ab-hockey-tamanho.ts 5,5,0.044,0.07,0.46 [...]
 *  (disco m/s, rebatedor m/s, raio disco, raio rebatedor, largura do gol). Robô × robô: o "humano médio" defende ~95%. */
import { AH, TABLE, setSizesForBench } from '../src/games/airhockey/physics';
import { attackRate, defenseRate, playVsRef, REF } from '../tests/bench/hockey';
const pct = (x: number) => (100 * x).toFixed(0) + '%';
const combos = process.argv.slice(2).map((a) => a.split(',').map(Number));
for (const [puck, mallet, pr, mr, goal] of combos) {
  AH.maxPuckSpeed = puck; AH.maxMalletSpeed = mallet; setSizesForBench(pr, mr); TABLE.goal = goal;
  let line = `disco ${puck}/${mallet} m/s r ${pr}/${mr} gol ${goal} | travessia ${(2 / puck).toFixed(2)} s | humano médio defende ${pct(defenseRate('medium', 200, 5, REF))}`;
  for (const d of ['easy', 'medium', 'hard'] as const) {
    let ai = 0, ref = 0, mins = 0;
    for (let i = 0; i < 10; i++) { const r = playVsRef(d, REF, 100 + i, 120); ai += r.aiGoals; ref += r.refGoals; mins += r.mins; }
    line += `\n   ${d.padEnd(6)} IA ${pct(ai / (ai + ref))} dos gols | ${((ai + ref) / mins).toFixed(1)} gols/min | defesa IA ${pct(defenseRate(d))} | tacada ${attackRate(d).shotSpeed.toFixed(1)}`;
  }
  console.log(line);
}
