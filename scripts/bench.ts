/** Imprime as medições de IA. Uso: npx vite-node scripts/bench.ts [hockey|pool] */
import { attackRate, benchHockey, defenseRate, REF } from '../tests/bench/hockey';
import { matchRate, potRate } from '../tests/bench/pool';

const only = process.argv[2];
const pct = (x: number) => (100 * x).toFixed(0) + '%';
if (!only || only === 'hockey') {
  console.log('AIR HOCKEY — referência (humano médio) defende', pct(defenseRate('medium', 200, 5, REF)));
  const m = benchHockey();
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const a = attackRate(d);
    console.log(`  ${d.padEnd(6)} defesas ${pct(defenseRate(d))} | ataque vira gol ${pct(a.goals)} | tacada ${a.shotSpeed.toFixed(1)} m/s | partidas: ${pct(m[d].share)} dos gols`);
  }
}
if (!only || only === 'pool') {
  console.log('SINUCA');
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const t0 = Date.now();
    const r = potRate(d);
    console.log(`  ${d.padEnd(6)} encaçapa ${pct(r.pot)} | falta ${pct(r.foul)} | ${((Date.now() - t0) / 60).toFixed(0)} ms/tacada`);
  }
  if (process.argv[3] === 'matches') {
    console.log('  médio × fácil: médio vence', pct(matchRate('medium', 'easy')));
    console.log('  difícil × médio: difícil vence', pct(matchRate('hard', 'medium')));
  }
}
if (!only || only === 'trails') {
  const { duel } = await import('../tests/bench/trails');
  console.log('DUELO DE RASTROS (rodadas IA × IA)');
  for (const [a, b] of [['medium', 'easy'], ['hard', 'medium']] as const) {
    const r = duel(a, b, 200);
    console.log(`  ${a} × ${b}: ${a} vence ${pct(r.winA)} | empates ${pct(r.draws)} | ${r.steps.toFixed(0)} passos`);
  }
}
if (!only || only === 'stack') {
  const { soloHeight, stackDuel } = await import('../tests/bench/stack');
  console.log('EMPILHA');
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const r = soloHeight(d);
    console.log(`  ${d.padEnd(6)} sozinha empilha ${r.pieces.toFixed(1)} peças (limite 25) | ${r.ms.toFixed(0)} ms por decisão`);
  }
  console.log('  médio × fácil: médio vence', pct(stackDuel('medium', 'easy', 20)));
  console.log('  difícil × médio: difícil vence', pct(stackDuel('hard', 'medium', 12)));
}
if (!only || only === 'connect4') {
  const { c4Duel } = await import('../tests/bench/connect4');
  console.log('LIG-4 (partidas IA × IA, alternando quem começa)');
  for (const [a, b] of [['easy', 'random'], ['medium', 'easy'], ['hard', 'medium']] as const) {
    const r = c4Duel(a, b, 40);
    console.log(`  ${a} × ${b}: ${a} faz ${pct(r.score)} dos pontos | ${r.ms.toFixed(1)} ms por jogada`);
  }
}
if (!only || only === 'pong') {
  const { pongVsRef } = await import('../tests/bench/pong');
  console.log('PONG (contra "humano médio" simulado)');
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const r = pongVsRef(d, 10);
    console.log(`  ${d.padEnd(6)} faz ${pct(r.share)} dos pontos | ${r.rally.toFixed(1)} rebatidas por ponto`);
  }
}
