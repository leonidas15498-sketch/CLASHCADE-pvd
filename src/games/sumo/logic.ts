/**
 * Sumô Neon — física e regras puras (sem DOM). Unidades: raio do ringue = 1 u. Passo fixo 1/120 s.
 * Regras (proposta original, 01/11): dois lutadores no ringue circular; joystick acelera, toque rápido dá um
 * avanço (dash) com recarga. Quem sair do ringue perde o round; os dois juntos = round anulado (repete).
 * O ringue encolhe depois de 10 s (até 60% em 20 s) para nenhum round se arrastar; aos 20 s vence quem estiver
 * mais perto do centro. Partida: melhor de 3 (2 rounds).
 */
export const SUMO = {
  dt: 1 / 120,
  ringR: 1,
  bodyR: 0.16,
  /** Aceleração do joystick (u/s²) e arrasto (1/s): velocidade de cruzeiro ≈ acc/drag = 1,6 u/s. */
  acc: 4.4,
  drag: 2.75,
  /** Avanço: +velocidade instantânea na direção do joystick (ou do rival) e recarga. */
  dashV: 2.3,
  dashCd: 1.15,
  /** Restituição do choque entre os dois (0 = gruda, 1 = elástico). */
  bounce: 0.85,
  shrinkStart: 10,
  roundTime: 20,
  minRing: 0.6,
  roundsToWin: 2,
  /** Pausa antes de cada round (s). */
  freeze: 1.1,
} as const;

export interface Wrestler {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Joystick atual (|v| ≤ 1). */
  ix: number;
  iy: number;
  cd: number;
  /** Último sentido em que olhou (para o avanço sem joystick). */
  fx: number;
  fy: number;
}

export type SumoEvent =
  | { type: 'hit'; x: number; y: number; power: number }
  | { type: 'dash'; p: 0 | 1 }
  | { type: 'out'; loser: 0 | 1 | 'both'; x: number; y: number }
  | { type: 'timeout'; winner: 0 | 1 | null }
  | { type: 'round'; n: number };

export interface SumoState {
  w: [Wrestler, Wrestler];
  t: number;
  /** Tempo do round atual. */
  rt: number;
  round: number;
  wins: [number, number];
  freeze: number;
  winner: 0 | 1 | null;
  events: SumoEvent[];
  /** Round acabou e espera o próximo (s). */
  between: number;
}

const wrestler = (x: number, fx: number): Wrestler => ({ x, y: 0, vx: 0, vy: 0, ix: 0, iy: 0, cd: 0, fx, fy: 0 });

export function createSumo(): SumoState {
  return { w: [wrestler(-0.45, 1), wrestler(0.45, -1)], t: 0, rt: 0, round: 1, wins: [0, 0], freeze: SUMO.freeze, winner: null, events: [], between: 0 };
}

export function resetRound(s: SumoState) {
  s.w = [wrestler(-0.45, 1), wrestler(0.45, -1)];
  s.rt = 0;
  s.freeze = SUMO.freeze;
  s.between = 0;
  s.events.push({ type: 'round', n: s.round });
}

/** Raio atual do ringue (encolhe de 10 s a 20 s). */
export function ringRadius(rt: number): number {
  if (rt <= SUMO.shrinkStart) return SUMO.ringR;
  const k = Math.min(1, (rt - SUMO.shrinkStart) / (SUMO.roundTime - SUMO.shrinkStart));
  return SUMO.ringR - (SUMO.ringR - SUMO.minRing) * k;
}

export function setInput(s: SumoState, p: 0 | 1, ix: number, iy: number) {
  const m = Math.hypot(ix, iy);
  const k = m > 1 ? 1 / m : 1;
  const w = s.w[p];
  w.ix = ix * k;
  w.iy = iy * k;
  if (m > 0.2) {
    w.fx = ix / m;
    w.fy = iy / m;
  }
}

/** Avanço (dash). Retorna false se em recarga ou fora de jogo. */
export function dash(s: SumoState, p: 0 | 1): boolean {
  const w = s.w[p];
  if (w.cd > 0 || s.freeze > 0 || s.between > 0 || s.winner !== null) return false;
  let dx = w.ix;
  let dy = w.iy;
  let m = Math.hypot(dx, dy);
  if (m < 0.2) {
    // sem joystick: avança na direção do rival
    const o = s.w[1 - p];
    dx = o.x - w.x;
    dy = o.y - w.y;
    m = Math.hypot(dx, dy);
  }
  if (m < 1e-6) return false;
  w.vx += (dx / m) * SUMO.dashV;
  w.vy += (dy / m) * SUMO.dashV;
  w.cd = SUMO.dashCd;
  s.events.push({ type: 'dash', p });
  return true;
}

export function stepSumo(s: SumoState) {
  const dt = SUMO.dt;
  s.t += dt;
  if (s.winner !== null) {
    const f = Math.exp(-SUMO.drag * dt);
    for (const w of s.w) {
      w.vx *= f;
      w.vy *= f;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
    }
    return;
  }
  if (s.between > 0) {
    // só visual: quem saiu continua deslizando até parar
    const f = Math.exp(-SUMO.drag * dt);
    for (const w of s.w) {
      w.vx *= f;
      w.vy *= f;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
    }
    s.between -= dt;
    if (s.between <= 0) resetRound(s);
    return;
  }
  if (s.freeze > 0) {
    s.freeze -= dt;
    return;
  }
  s.rt += dt;
  const f = Math.exp(-SUMO.drag * dt);
  for (const w of s.w) {
    w.vx = (w.vx + w.ix * SUMO.acc * dt) * f;
    w.vy = (w.vy + w.iy * SUMO.acc * dt) * f;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    w.cd = Math.max(0, w.cd - dt);
  }
  // choque entre os dois (massas iguais): separa e troca a componente normal com restituição
  const [a, b] = s.w;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 2 * SUMO.bodyR;
  if (d < min && d > 1e-9) {
    const nx = dx / d;
    const ny = dy / d;
    const push = (min - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel > 0) {
      const j = ((1 + SUMO.bounce) * rel) / 2;
      a.vx -= j * nx;
      a.vy -= j * ny;
      b.vx += j * nx;
      b.vy += j * ny;
      if (rel > 0.4) s.events.push({ type: 'hit', x: a.x + nx * SUMO.bodyR, y: a.y + ny * SUMO.bodyR, power: rel });
    }
  }
  // fora do ringue = centro passou da borda
  const R = ringRadius(s.rt);
  const out = s.w.map((w) => Math.hypot(w.x, w.y) > R);
  if (out[0] || out[1]) {
    const loser: 0 | 1 | 'both' = out[0] && out[1] ? 'both' : out[0] ? 0 : 1;
    const lw = loser === 'both' ? a : s.w[loser];
    s.events.push({ type: 'out', loser, x: lw.x, y: lw.y });
    endRound(s, loser === 'both' ? null : ((1 - loser) as 0 | 1));
    return;
  }
  if (s.rt >= SUMO.roundTime) {
    const da = Math.hypot(a.x, a.y);
    const db = Math.hypot(b.x, b.y);
    const w = Math.abs(da - db) < 0.01 ? null : da < db ? 0 : 1;
    s.events.push({ type: 'timeout', winner: w });
    endRound(s, w);
  }
}

function endRound(s: SumoState, winner: 0 | 1 | null) {
  if (winner !== null) {
    s.wins[winner]++;
    if (s.wins[winner] >= SUMO.roundsToWin) {
      s.winner = winner;
      return;
    }
    s.round++;
  }
  // round anulado (os dois saíram / empate no tempo) repete com o mesmo número
  s.between = 1.0;
  for (const w of s.w) {
    w.ix = 0;
    w.iy = 0;
  }
}
