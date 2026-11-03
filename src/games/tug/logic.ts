/**
 * Cabo de Guerra rítmico — regras puras (sem DOM). Tempo em segundos desde o início da partida.
 * Proposta original (01/11): uma batida regular; cada jogador toca no SEU botão no tempo da batida.
 * - Perfeito (±55 ms): puxa 3; Bom (±130 ms): puxa 2 (multiplicado pelo combo, até ×1,5).
 * - Toque fora da janela, ou segundo toque na mesma batida: escorrega 1 para o lado do rival e zera o combo
 *   (anula "metralhar" o botão). Batida sem toque: zera o combo.
 * - A batida acelera de 100 para 140 BPM ao longo da partida. Corda a ±ROPE_WIN vence; aos 60 s vence quem
 *   estiver com a corda do seu lado (no meio exato = empate).
 * Corda: negativo = lado do J1 (coral), positivo = lado do J2 (azul).
 */
export const TUG = {
  perfect: 0.055,
  good: 0.13,
  pullPerfect: 3,
  pullGood: 2,
  slip: 1,
  comboMax: 5,
  comboStep: 0.1,
  ropeWin: 32,
  bpm0: 100,
  bpm1: 140,
  /** Batidas até chegar ao BPM máximo. */
  rampBeats: 64,
  maxTime: 60,
  /** Contagem antes da 1ª batida (s). */
  lead: 2.4,
} as const;

export type Judge = 'perfect' | 'good' | 'off' | 'double';
export type TapEvent = { type: 'tap'; p: 0 | 1; judge: Judge; beat: number; delta: number; pull: number };
export type TugEvent = TapEvent | { type: 'miss'; p: 0 | 1; beat: number } | { type: 'end'; winner: 0 | 1 | null };

export interface TugState {
  /** Instantes das batidas (s). */
  beats: number[];
  rope: number;
  combo: [number, number];
  /** Última batida já julgada por jogador (toque contado). */
  hitBeat: [number, number];
  /** Próxima batida ainda não encerrada (para "miss"). */
  closed: number;
  winner: 0 | 1 | null;
  over: boolean;
  t: number;
  events: TugEvent[];
  stats: [{ perfect: number; good: number; off: number; miss: number }, { perfect: number; good: number; off: number; miss: number }];
}

export function bpmAt(k: number): number {
  return TUG.bpm0 + (TUG.bpm1 - TUG.bpm0) * Math.min(1, k / TUG.rampBeats);
}

export function makeBeats(): number[] {
  const out: number[] = [];
  let t = TUG.lead;
  for (let k = 0; t < TUG.maxTime + 2; k++) {
    out.push(t);
    t += 60 / bpmAt(k);
  }
  return out;
}

export function createTug(): TugState {
  const z = () => ({ perfect: 0, good: 0, off: 0, miss: 0 });
  return { beats: makeBeats(), rope: 0, combo: [0, 0], hitBeat: [-1, -1], closed: 0, winner: null, over: false, t: 0, events: [], stats: [z(), z()] };
}

/** Batida mais próxima de t (índice). */
export function nearestBeat(s: TugState, t: number): number {
  const b = s.beats;
  let lo = 0;
  let hi = b.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (b[mid] < t) lo = mid;
    else hi = mid;
  }
  return Math.abs(b[lo] - t) <= Math.abs(b[hi] - t) ? lo : hi;
}

const sign = (p: 0 | 1) => (p === 0 ? -1 : 1);

export function tap(s: TugState, p: 0 | 1, t: number): TapEvent | null {
  if (s.over || t < TUG.lead - TUG.good) return null;
  const k = nearestBeat(s, t);
  const delta = t - s.beats[k];
  const ad = Math.abs(delta);
  let judge: Judge;
  let pull: number;
  if (ad > TUG.good) judge = 'off';
  else if (s.hitBeat[p] === k) judge = 'double';
  else judge = ad <= TUG.perfect ? 'perfect' : 'good';
  if (judge === 'off' || judge === 'double') {
    pull = -TUG.slip;
    s.combo[p] = 0;
    s.stats[p].off++;
  } else {
    s.hitBeat[p] = k;
    const mult = 1 + TUG.comboStep * Math.min(TUG.comboMax, s.combo[p]);
    pull = (judge === 'perfect' ? TUG.pullPerfect : TUG.pullGood) * mult;
    s.combo[p]++;
    s.stats[p][judge]++;
  }
  s.rope += sign(p) * pull;
  const ev: TapEvent = { type: 'tap', p, judge, beat: k, delta, pull };
  s.events.push(ev);
  checkEnd(s);
  return ev;
}

/** Avança o relógio: fecha batidas vencidas (sem toque = zera combo) e checa o tempo-limite. */
export function advance(s: TugState, t: number) {
  if (s.over) return;
  s.t = t;
  while (s.closed < s.beats.length && t > s.beats[s.closed] + TUG.good) {
    for (const p of [0, 1] as const)
      if (s.hitBeat[p] !== s.closed) {
        s.combo[p] = 0;
        s.stats[p].miss++;
        s.events.push({ type: 'miss', p, beat: s.closed });
      }
    s.closed++;
  }
  if (t >= TUG.maxTime) {
    s.over = true;
    s.winner = Math.abs(s.rope) < 1e-9 ? null : s.rope < 0 ? 0 : 1;
    s.events.push({ type: 'end', winner: s.winner });
  }
}

function checkEnd(s: TugState) {
  if (Math.abs(s.rope) >= TUG.ropeWin) {
    s.over = true;
    s.winner = s.rope < 0 ? 0 : 1;
    s.events.push({ type: 'end', winner: s.winner });
  }
}
