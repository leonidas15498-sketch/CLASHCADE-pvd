/**
 * Duelo de Rastros — regras puras (sem DOM). Arena em grade; cada moto anda 1 célula por passo e deixa rastro.
 * Bateu em parede ou rastro = perde a rodada. Os dois batem no mesmo passo (ou de frente) = empate na rodada.
 */
export const GRID = { w: 48, h: 28 };
/** 0 = cima, 1 = direita, 2 = baixo, 3 = esquerda. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const ROUNDS_TO_WIN = 3;
/** Passos por segundo: começa em BASE e acelera até MAX (rodadas longas não ficam paradas). */
export const SPEED = { base: 9, max: 15, rampSecs: 40 };

export interface Bike {
  x: number;
  y: number;
  dir: Dir;
  /** Curvas pedidas e ainda não aplicadas (até 2, para curvas rápidas em "U"). */
  queue: Dir[];
  alive: boolean;
}

export interface RoundState {
  /** 0 = livre; 1 = rastro do J1; 2 = rastro do J2. */
  grid: Uint8Array;
  bikes: [Bike, Bike];
  steps: number;
  /** null = em andamento; 0/1 = vencedor da rodada; 'draw' = empate. */
  result: 0 | 1 | 'draw' | null;
  /** Onde cada moto bateu (para o efeito). */
  crashes: Array<{ p: 0 | 1; x: number; y: number }>;
  /**
   * Trajeto real de cada moto, em ordem cronológica (índices de célula). O desenho usa ISTO, nunca "células vizinhas da
   * mesma cor" — dois trechos paralelos do mesmo jogador não podem parecer ligados.
   */
  paths: [number[], number[]];
}

export const idx = (x: number, y: number) => y * GRID.w + x;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID.w && y < GRID.h;

/** Rodada nova: J1 à esquerda indo para a direita, J2 à direita indo para a esquerda. `offset` desloca a altura. */
export function createRound(offset = 0): RoundState {
  const g = new Uint8Array(GRID.w * GRID.h);
  const y = Math.max(2, Math.min(GRID.h - 3, Math.floor(GRID.h / 2) + offset));
  const a: Bike = { x: 6, y, dir: 1, queue: [], alive: true };
  const b: Bike = { x: GRID.w - 7, y: GRID.h - 1 - y, dir: 3, queue: [], alive: true };
  g[idx(a.x, a.y)] = 1;
  g[idx(b.x, b.y)] = 2;
  return { grid: g, bikes: [a, b], steps: 0, result: null, crashes: [], paths: [[idx(a.x, a.y)], [idx(b.x, b.y)]] };
}

/** Pede uma curva. Ignora meia-volta (bater no próprio rastro) e repetição da direção atual. */
export function turn(s: RoundState, p: 0 | 1, d: Dir): void {
  const b = s.bikes[p];
  const last = b.queue.length ? b.queue[b.queue.length - 1] : b.dir;
  if (d === last || (d + 2) % 4 === last) return;
  // Do not discard the first corner: the second might reverse the current heading.
  if (b.queue.length >= 2) return;
  b.queue.push(d);
}

/** Um passo da rodada. */
export function stepRound(s: RoundState): void {
  if (s.result !== null) return;
  s.steps++;
  const next = s.bikes.map((b) => {
    if (b.queue.length) b.dir = b.queue.shift()!;
    return { x: b.x + DX[b.dir], y: b.y + DY[b.dir] };
  });
  const dead = [false, false];
  for (const p of [0, 1] as const) {
    const n = next[p];
    if (!inside(n.x, n.y) || s.grid[idx(n.x, n.y)] !== 0) dead[p] = true;
  }
  // de frente: mesma célula, ou trocando de lugar
  const [a, b] = s.bikes;
  if (next[0].x === next[1].x && next[0].y === next[1].y) dead[0] = dead[1] = true;
  if (next[0].x === b.x && next[0].y === b.y && next[1].x === a.x && next[1].y === a.y) dead[0] = dead[1] = true;
  for (const p of [0, 1] as const) {
    const bk = s.bikes[p];
    if (dead[p]) {
      bk.alive = false;
      s.crashes.push({ p, x: next[p].x, y: next[p].y });
    } else {
      bk.x = next[p].x;
      bk.y = next[p].y;
      s.grid[idx(bk.x, bk.y)] = p + 1;
      s.paths[p].push(idx(bk.x, bk.y));
    }
  }
  if (dead[0] && dead[1]) s.result = 'draw';
  else if (dead[0]) s.result = 1;
  else if (dead[1]) s.result = 0;
}

/** Passos por segundo após `t` segundos de rodada. */
export function stepsPerSecond(t: number): number {
  const k = Math.min(1, t / SPEED.rampSecs);
  return SPEED.base + (SPEED.max - SPEED.base) * k;
}

export interface MatchScore {
  rounds: [number, number];
  winner: 0 | 1 | null;
}

export function addRound(m: MatchScore, r: 0 | 1 | 'draw'): MatchScore {
  if (r === 'draw') return m;
  const rounds: [number, number] = [m.rounds[0], m.rounds[1]];
  rounds[r]++;
  return { rounds, winner: rounds[r] >= ROUNDS_TO_WIN ? r : null };
}
