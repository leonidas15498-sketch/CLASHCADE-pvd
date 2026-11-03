/**
 * Medição de "game feel" da Torre de Bichinhos (antes/depois de mexer na física).
 * Uso: npx vite-node scripts/torre-feel.ts
 * - Estabilização: do 1º contato da peça solta até a pilha ficar abaixo de 0,08 de movimento de vez (s).
 * - Turno: do SOLTAR até passar a vez (o que o jogador espera de fato).
 * - Peças por partida: IA × IA (o "humano" é a IA Média, suposição: não é gente de verdade).
 */
import { makeRng } from '../src/games/pool/ai/ai';
import type { Difficulty } from '../src/games/shared/shell';
import { chooseStackDrop } from '../src/games/stack/ai';
import { CORNER, DAMPING, DT, StackMatch } from '../src/games/stack/logic';

// ANTES=1 reproduz a física anterior a 01/11 noite (giro 0,15, sem amortecimento linear, cantos vivos)
if (process.env.ANTES) {
  DAMPING.angular = 0.15;
  DAMPING.linear = 0;
  CORNER.r = 0;
}
console.log('Física:', DAMPING, 'cantos', CORNER.r);

const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};

function turn(m: StackMatch, d: Difficulty, rng: () => number, rest: number[], turnT: number[], peak: number[]) {
  const c = chooseStackDrop(m, d, rng);
  m.drop(c.x, c.angle);
  let contact = -1;
  let lastMove = 0;
  let t = 0;
  let pk = 0;
  const onC = () => {
    if (contact < 0) contact = t;
  };
  m.sw.world.on('begin-contact', onC);
  let r = null;
  while (r === null) {
    r = m.tick();
    t += DT;
    const mo = m.sw.motion();
    // giro acumulado depois do contato (rad): mede o "balanço" da pilha
    if (contact >= 0) for (const p of m.sw.pieces) pk += Math.abs(p.body.getAngularVelocity()) * DT;
    if (mo >= 0.08) lastMove = t;
  }
  m.sw.world.off('begin-contact', onC);
  if (r === 'next') {
    rest.push(Math.max(0, lastMove - Math.max(0, contact)));
    turnT.push(t);
    peak.push(pk);
  }
  return r;
}

const rest: number[] = [];
const turnT: number[] = [];
const peak: number[] = [];
const solo: Record<string, number> = {};
for (const d of (process.env.SO_CONTROLADO ? [] : ["easy", "medium", "hard"]) as Difficulty[]) {
  let tot = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const rng = makeRng(900 + i);
    const m = new StackMatch(1, rng);
    while (m.phase !== 'over' && m.placed < 25) turn(m, d, rng, rest, turnT, peak);
    tot += m.placed;
  }
  solo[d] = tot / N;
}
const duel: Record<string, { pieces: number; humanWin: number }> = {};
for (const d of (process.env.SO_CONTROLADO ? [] : ["easy", "medium", "hard"]) as Difficulty[]) {
  let pieces = 0;
  let hw = 0;
  const N = 16;
  for (let i = 0; i < N; i++) {
    const rng = makeRng(4000 + i);
    const m = new StackMatch(2, rng);
    const human = (i % 2) as 0 | 1;
    let n = 0;
    while (m.phase !== 'over' && n < 60) {
      turn(m, m.current === human ? 'medium' : d, rng, rest, turnT, peak);
      n++;
    }
    pieces += m.placed;
    if (m.loser !== null && m.loser !== human) hw++;
  }
  duel[d] = { pieces: pieces / N, humanWin: hw / N };
}
const f = (x: number | undefined) => (x ?? NaN).toFixed(2);
console.log(`Estabilização (1º contato → parado), ${rest.length} jogadas: mediana ${f(q(rest, 0.5))} s, p90 ${f(q(rest, 0.9))} s`);
console.log(`Turno (SOLTAR → passa a vez): mediana ${f(q(turnT, 0.5))} s, p90 ${f(q(turnT, 0.9))} s, máx ${f(q(turnT, 1))} s`);
console.log(`Balanço (giro acumulado das peças após o contato, rad): mediana ${f(q(peak, 0.5))}, p90 ${f(q(peak, 0.9))}`);
console.log(`Solo (peças, limite 25): Fácil ${f(solo.easy)} · Médio ${f(solo.medium)} · Difícil ${f(solo.hard)}`);
for (const d of Object.keys(duel)) console.log(`"Humano" (IA Média) × IA ${d}: ${f(duel[d].pieces)} peças/partida, humano vence ${(duel[d].humanWin * 100).toFixed(0)}%`);

// ---- Cenário controlado (mesmas jogadas antes/depois): peça B solta sobre peça A, deslocada 0 / 0,2 / 0,35 u.
// Mede só o que a física muda (as partidas IA × IA acima mudam de rumo e misturam sorte da peça).
{
  const ids = ['gato', 'sapo', 'presente', 'bolo', 'urso', 'panda', 'pinguim', 'melancia'];
  const restC: number[] = [];
  const rotC: number[] = [];
  let fell = 0;
  for (const a of ids)
    for (const b of ids)
      for (const off of [0, 0.2, 0.35]) {
        const m = new StackMatch(2, makeRng(1));
        m.piece = a;
        m.drop(0, 0);
        while (m.tick() === null);
        m.piece = b;
        m.drop(off, 0);
        let t = 0;
        let contact = -1;
        let last = 0;
        let rot = 0;
        const onC = () => {
          if (contact < 0) contact = t;
        };
        m.sw.world.on('begin-contact', onC);
        let r = null;
        while (r === null) {
          r = m.tick();
          t += DT;
          if (m.sw.motion() >= 0.08) last = t;
          if (contact >= 0) for (const p of m.sw.pieces) rot += Math.abs(p.body.getAngularVelocity()) * DT;
        }
        if (r === 'fell') fell++;
        else {
          restC.push(Math.max(0, last - contact));
          rotC.push(rot);
        }
      }
  console.log(`Controlado (${ids.length}×${ids.length}×3 = ${ids.length * ids.length * 3} quedas): caíram ${fell}; estabilização mediana ${f(q(restC, 0.5))} s, p90 ${f(q(restC, 0.9))} s, máx ${f(q(restC, 1))} s; giro acumulado mediana ${f(q(rotC, 0.5))} rad, p90 ${f(q(rotC, 0.9))} rad`);
}
