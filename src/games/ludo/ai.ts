/**
 * IA do Ludo: escolhe QUAL peão mover (o dado é sorte). Usa as mesmas regras (logic.ts).
 * Fácil: peão ao acaso. Médio: prioridades simples (capturar, chegar, sair da base, andar o da frente).
 * Difícil: dá nota a cada opção simulando o lance e pesando o risco de ser capturado (rivais 1 a 6 casas atrás).
 * Medido em tests/bench/ludo.ts.
 */
import type { Difficulty } from '../shared/shell';
import { clone, FINISH, LudoState, moveToken, movable, SAFE, trackIndex, TRACK_LEN } from './logic';

/** Quantos peões rivais estão de 1 a 6 casas atrás da casa `ti` (podem capturá-la no próximo dado). */
function threat(s: LudoState, me: number, ti: number): number {
  if (ti < 0 || SAFE.has(ti)) return 0;
  let n = 0;
  for (let o = 0; o < s.players; o++) {
    if (o === me) continue;
    for (const op of s.pos[o]) {
      const oi = trackIndex(s, o, op);
      if (oi < 0) continue;
      const dist = (ti - oi + TRACK_LEN) % TRACK_LEN;
      if (dist >= 1 && dist <= 6) n++;
    }
  }
  return n;
}

function score(s: LudoState, token: number): number {
  const me = s.current;
  const before = s.pos[me][token];
  const n = clone(s);
  const r = moveToken(n, token);
  const after = n.pos[me][token];
  let v = 0;
  v += r.captured.length * 60;
  if (r.finished) v += 50;
  if (before < 0) v += 35;
  if (after > 50 && before <= 50) v += 25; // entrou no corredor: ninguém pega mais
  v += (after - Math.max(0, before)) * 0.5;
  // risco: sair de uma casa ameaçada é bom, parar numa casa ameaçada é ruim
  v += threat(s, me, trackIndex(s, me, before)) * 12;
  v -= threat(n, me, trackIndex(n, me, after)) * 18 * (after / FINISH + 0.5);
  if (SAFE.has(trackIndex(n, me, after))) v += 8;
  return v;
}

export function chooseLudo(s: LudoState, d: Difficulty, rng: () => number): number {
  const opts = movable(s);
  if (opts.length <= 1) return opts[0];
  if (d === 'easy') return opts[Math.floor(rng() * opts.length)];
  if (d === 'medium') {
    const me = s.current;
    // capturar > chegar > sair da base > o peão mais adiantado que não está no corredor
    let best = opts[0];
    let bestV = -Infinity;
    for (const t of opts) {
      const n = clone(s);
      const r = moveToken(n, t);
      const p = s.pos[me][t];
      const v = r.captured.length * 100 + (r.finished ? 80 : 0) + (p < 0 ? 60 : 0) + (p >= 0 ? p : 0) + rng() * 5;
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    return best;
  }
  let best = opts[0];
  let bestV = -Infinity;
  for (const t of opts) {
    const v = score(s, t) + rng() * 0.5;
    if (v > bestV) {
      bestV = v;
      best = t;
    }
  }
  return best;
}
