import type { Difficulty } from '../shared/shell';
import { Dir, DX, DY, GRID, idx, inside, RoundState, turn } from './logic';

/**
 * IA do Duelo de Rastros. Decide uma vez por passo, olhando a grade (mesma informação do humano).
 * - Fácil: só olha a célula da frente; às vezes se distrai e bate; faz curvas à toa.
 * - Médio: escolhe a direção com mais espaço livre (inundação/flood fill), às vezes se distrai.
 * - Difícil: disputa território (quem chega antes em cada célula) e evita encontro de frente.
 */
export interface TrailsCfg {
  /** Chance por passo de não olhar nada (segue reto mesmo se bater). */
  lapse: number;
  /** Chance por passo de virar sem motivo (entre as direções seguras). */
  wander: number;
  /** Profundidade da análise: 'look1' = só a frente; 'space' = espaço livre; 'territory' = território. */
  brain: 'look1' | 'space' | 'territory';
}
export const TRAILS_AI: Record<Difficulty, TrailsCfg> = {
  easy: { lapse: 0.035, wander: 0.06, brain: 'look1' },
  medium: { lapse: 0.006, wander: 0.02, brain: 'space' },
  hard: { lapse: 0, wander: 0, brain: 'territory' },
};

const free = (s: RoundState, x: number, y: number) => inside(x, y) && s.grid[idx(x, y)] === 0;

/** Células alcançáveis a partir de (x, y) (limitado para não pesar). */
export function floodArea(s: RoundState, x: number, y: number, cap = 600): number {
  if (!free(s, x, y)) return 0;
  const seen = new Uint8Array(GRID.w * GRID.h);
  const q = [idx(x, y)];
  seen[q[0]] = 1;
  let n = 0;
  while (n < q.length && n < cap) {
    const c = q[n++];
    const cx = c % GRID.w;
    const cy = (c / GRID.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (!free(s, nx, ny)) continue;
      const i = idx(nx, ny);
      if (seen[i]) continue;
      seen[i] = 1;
      q.push(i);
    }
  }
  return n;
}

/** BFS simultânea: [células em que eu chego antes, em que o rival chega antes, os dois se alcançam?]. */
export function territory(s: RoundState, me: { x: number; y: number }, opp: { x: number; y: number }): { mine: number; theirs: number; touch: boolean } {
  const N = GRID.w * GRID.h;
  const dist = [new Int16Array(N).fill(-1), new Int16Array(N).fill(-1)];
  const qs: number[][] = [[], []];
  const starts = [me, opp];
  for (const k of [0, 1]) {
    const i = idx(starts[k].x, starts[k].y);
    dist[k][i] = 0;
    qs[k].push(i);
  }
  for (const k of [0, 1]) {
    const q = qs[k];
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const cx = c % GRID.w;
      const cy = (c / GRID.w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (!free(s, nx, ny)) continue;
        const i = idx(nx, ny);
        if (dist[k][i] >= 0) continue;
        dist[k][i] = dist[k][c] + 1;
        q.push(i);
      }
    }
  }
  let mine = 0;
  let theirs = 0;
  let touch = false;
  for (let i = 0; i < N; i++) {
    const a = dist[0][i];
    const b = dist[1][i];
    if (a > 0 && b > 0) touch = true;
    if (a > 0 && (b < 0 || a < b)) mine++;
    else if (b > 0 && (a < 0 || b < a)) theirs++;
  }
  return { mine, theirs, touch };
}

export class TrailsAI {
  constructor(
    public difficulty: Difficulty,
    private rng: () => number = Math.random,
    /** Qual moto a IA controla (padrão: J2). */
    private me: 0 | 1 = 1,
  ) {}

  get cfg(): TrailsCfg {
    return TRAILS_AI[this.difficulty];
  }

  /** Chamar uma vez antes de cada passo da rodada. */
  think(s: RoundState): void {
    const c = this.cfg;
    const b = s.bikes[this.me];
    if (!b.alive || s.result !== null) return;
    if (this.rng() < c.lapse) return; // distraído: segue reto
    const options = ([0, 1, 2, 3] as Dir[]).filter((d) => (d + 2) % 4 !== b.dir);
    const safe = options.filter((d) => free(s, b.x + DX[d], b.y + DY[d]));
    if (!safe.length) return;
    let best: Dir = b.dir;
    if (c.brain === 'look1') {
      const aheadOk = safe.includes(b.dir);
      if (!aheadOk || this.rng() < c.wander) best = safe[Math.floor(this.rng() * safe.length)];
    } else {
      const o = s.bikes[1 - this.me];
      let bestVal = -Infinity;
      for (const d of safe) {
        const nx = b.x + DX[d];
        const ny = b.y + DY[d];
        let val: number;
        if (c.brain === 'space') {
          val = floodArea(s, nx, ny);
        } else {
          // simula a minha célula ocupada e mede o território
          s.grid[idx(nx, ny)] = 9;
          const t = territory(s, { x: nx, y: ny }, o);
          const area = floodArea(s, nx + DX[d], ny + DY[d]) + 1; // espaço à frente após este passo
          s.grid[idx(nx, ny)] = 0;
          val = t.touch ? t.mine - t.theirs : 2 * Math.min(area, floodArea(s, nx, ny));
          // evita célula que o rival pode ocupar no mesmo passo (batida de frente = empate)
          if (Math.abs(nx - o.x) + Math.abs(ny - o.y) === 1) val -= 50;
        }
        if (d === b.dir) val += 0.5; // prefere seguir reto no empate
        val += this.rng() * 0.1 + (this.rng() < c.wander ? 5 : 0);
        if (val > bestVal) {
          bestVal = val;
          best = d;
        }
      }
    }
    if (best !== b.dir) turn(s, this.me, best);
  }
}
