/**
 * Cobrinha (Snake) — regras puras (sem DOM).
 * - Grade GRID; cada cobra anda 1 célula por passo. Comeu fruta = cresce 1.
 * - Bater na parede, no próprio corpo ou no corpo da outra cobra = perde. A ponta do rabo que sai neste passo
 *   não conta como obstáculo (dá para "perseguir o próprio rabo", como no Snake clássico).
 * - Solo: 1 cobra, 1 fruta; acaba quando bate. Pontos = frutas comidas.
 * - Duelo (vs IA ou 2P): 2 cobras e 2 frutas. Vence a rodada quem sobreviver ou quem chegar a WIN_LEN segmentos.
 *   Batida de frente (mesma célula ou troca de lugar) ou as duas batendo no mesmo passo = rodada empatada.
 */
export const GRID = { w: 24, h: 16 };
/** 0 = cima, 1 = direita, 2 = baixo, 3 = esquerda. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
/** Tamanho que vence a rodada no duelo. */
export const WIN_LEN = 16;
export const START_LEN = 3;
export const ROUNDS_TO_WIN = 3;

export interface Snake {
  /** Células do corpo, cabeça primeiro (índice = y·w + x). */
  body: number[];
  dir: Dir;
  /** Curvas pedidas e ainda não aplicadas (até 2, para curvas rápidas em "U"). */
  queue: Dir[];
  alive: boolean;
  eaten: number;
}

export interface SnakeState {
  snakes: Snake[];
  fruits: number[];
  steps: number;
  /** null = em andamento; 0/1 = vencedor da rodada (duelo); 'draw' = empate; 'over' = fim do solo. */
  result: 0 | 1 | 'draw' | 'over' | null;
  crashes: Array<{ p: number; x: number; y: number }>;
  /** Frutas comidas no último passo (para som e efeito). */
  ate: Array<{ p: number; cell: number }>;
  rng: () => number;
}

export const idx = (x: number, y: number) => y * GRID.w + x;
export const xy = (i: number) => ({ x: i % GRID.w, y: Math.floor(i / GRID.w) });
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID.w && y < GRID.h;

function makeSnake(x: number, y: number, dir: Dir): Snake {
  const body: number[] = [];
  for (let k = 0; k < START_LEN; k++) body.push(idx(x - DX[dir] * k, y - DY[dir] * k));
  return { body, dir, queue: [], alive: true, eaten: 0 };
}

export function createSnakeGame(players: 1 | 2, rng: () => number = Math.random): SnakeState {
  const mid = Math.floor(GRID.h / 2);
  const snakes = players === 1 ? [makeSnake(6, mid, 1)] : [makeSnake(5, mid - 3, 1), makeSnake(GRID.w - 6, mid + 2, 3)];
  const s: SnakeState = { snakes, fruits: [], steps: 0, result: null, crashes: [], ate: [], rng };
  const want = players === 1 ? 1 : 2;
  while (s.fruits.length < want) spawnFruit(s);
  return s;
}

/** Fruta numa célula livre ao acaso (longe das cabeças, se der). */
export function spawnFruit(s: SnakeState): void {
  const busy = new Uint8Array(GRID.w * GRID.h);
  for (const sn of s.snakes) for (const c of sn.body) busy[c] = 1;
  for (const f of s.fruits) busy[f] = 1;
  const free: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < busy.length; i++) {
    if (busy[i]) continue;
    free.push(i);
    const p = xy(i);
    if (s.snakes.every((sn) => {
      const h = xy(sn.body[0]);
      return Math.abs(h.x - p.x) + Math.abs(h.y - p.y) > 2;
    })) far.push(i);
  }
  const pool = far.length ? far : free;
  if (pool.length) s.fruits.push(pool[Math.floor(s.rng() * pool.length)]);
}

/** Pede uma curva. Ignora meia-volta e repetição da direção atual. */
export function turn(s: SnakeState, p: number, d: Dir): void {
  const sn = s.snakes[p];
  if (!sn) return;
  const last = sn.queue.length ? sn.queue[sn.queue.length - 1] : sn.dir;
  if (d === last || (d + 2) % 4 === last) return;
  if (sn.queue.length >= 2) return;
  sn.queue.push(d);
}

/** Um passo do jogo. */
export function step(s: SnakeState): void {
  if (s.result !== null) return;
  s.steps++;
  s.ate = [];
  const live = s.snakes.map((sn) => sn.alive);
  const next = s.snakes.map((sn) => {
    if (sn.queue.length) sn.dir = sn.queue.shift()!;
    const h = xy(sn.body[0]);
    return { x: h.x + DX[sn.dir], y: h.y + DY[sn.dir] };
  });
  const eats = next.map((n, p) => live[p] && inside(n.x, n.y) && s.fruits.includes(idx(n.x, n.y)));
  // obstáculos: todos os corpos, menos a ponta do rabo de quem não vai crescer neste passo
  const busy = new Uint8Array(GRID.w * GRID.h);
  s.snakes.forEach((sn, p) => {
    if (!live[p]) return;
    const n = eats[p] ? sn.body.length : sn.body.length - 1;
    for (let k = 0; k < n; k++) busy[sn.body[k]] = 1;
  });
  const dead = s.snakes.map(() => false);
  next.forEach((n, p) => {
    if (!live[p]) return;
    if (!inside(n.x, n.y) || busy[idx(n.x, n.y)]) dead[p] = true;
  });
  if (s.snakes.length === 2 && live[0] && live[1]) {
    const [a, b] = s.snakes;
    const same = next[0].x === next[1].x && next[0].y === next[1].y;
    const swap = idx(next[0].x, next[0].y) === b.body[0] && idx(next[1].x, next[1].y) === a.body[0];
    if (same || swap) dead[0] = dead[1] = true;
  }
  s.snakes.forEach((sn, p) => {
    if (!live[p]) return;
    const n = next[p];
    if (dead[p]) {
      sn.alive = false;
      s.crashes.push({ p, x: n.x, y: n.y });
      return;
    }
    const c = idx(n.x, n.y);
    sn.body.unshift(c);
    if (eats[p]) {
      sn.eaten++;
      s.fruits = s.fruits.filter((f) => f !== c);
      s.ate.push({ p, cell: c });
    } else sn.body.pop();
  });
  const want = s.snakes.length === 1 ? 1 : 2;
  while (s.fruits.length < want && s.snakes.some((sn) => sn.alive)) {
    const before = s.fruits.length;
    spawnFruit(s);
    if (s.fruits.length === before) break; // grade cheia
  }
  // resultado
  if (s.snakes.length === 1) {
    if (!s.snakes[0].alive) s.result = 'over';
    return;
  }
  const [a, b] = s.snakes;
  if (!a.alive && !b.alive) s.result = 'draw';
  else if (!a.alive) s.result = 1;
  else if (!b.alive) s.result = 0;
  else if (a.body.length >= WIN_LEN || b.body.length >= WIN_LEN) {
    s.result = a.body.length === b.body.length ? 'draw' : a.body.length > b.body.length ? 0 : 1;
  }
}

/** Passos por segundo. Solo acelera com as frutas; duelo acelera com o tempo. */
export function stepsPerSecond(s: SnakeState, t: number): number {
  if (s.snakes.length === 1) return Math.min(14, 7 + s.snakes[0].eaten * 0.22);
  return 7.5 + Math.min(1, t / 45) * 3.5;
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
