import type { Difficulty } from '../shared/shell';
import { Dir, DX, DY, GRID, idx, inside, SnakeState, turn, xy } from './logic';

/**
 * IA da Cobrinha. Decide uma vez por passo, olhando a grade (a mesma informação do humano).
 * - Fácil: vai na direção da fruta mais próxima, só olha a célula da frente e às vezes se distrai.
 * - Médio: caminho mais curto até a fruta (BFS) e só entra se sobrar espaço livre do tamanho do corpo; reage
 *   mais devagar (às vezes segue reto alguns passos a mais) e por isso faz caminhos mais longos.
 * - Difícil: como o Médio, mas escolhe a fruta em que chega antes do rival, evita encostar de frente na cabeça
 *   dele e, sem caminho seguro, vai para onde há mais espaço.
 */
interface Cfg {
  lapse: number;
  /** Chance por passo de seguir reto (se for seguro) em vez de virar: reage mais devagar, faz caminhos mais longos. */
  inertia: number;
  brain: 'greedy' | 'path' | 'smart';
}
export const SNAKE_AI: Record<Difficulty, Cfg> = {
  easy: { lapse: 0.08, inertia: 0, brain: 'greedy' },
  medium: { lapse: 0.004, inertia: 0.35, brain: 'path' },
  hard: { lapse: 0, inertia: 0, brain: 'smart' },
};

/** Células ocupadas no próximo passo (os rabos saem, então não contam). */
function obstacles(s: SnakeState): Uint8Array {
  const busy = new Uint8Array(GRID.w * GRID.h);
  for (const sn of s.snakes) {
    if (!sn.alive) continue;
    for (let k = 0; k < sn.body.length - 1; k++) busy[sn.body[k]] = 1;
  }
  return busy;
}

function bfs(busy: Uint8Array, from: number): Int16Array {
  const dist = new Int16Array(GRID.w * GRID.h).fill(-1);
  dist[from] = 0;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const { x, y } = xy(c);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!inside(nx, ny)) continue;
      const n = idx(nx, ny);
      if (busy[n] || dist[n] >= 0) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return dist;
}

function area(busy: Uint8Array, from: number, cap: number): number {
  if (busy[from]) return 0;
  const seen = new Uint8Array(GRID.w * GRID.h);
  seen[from] = 1;
  const q = [from];
  for (let h = 0; h < q.length && q.length < cap; h++) {
    const { x, y } = xy(q[h]);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!inside(nx, ny)) continue;
      const n = idx(nx, ny);
      if (busy[n] || seen[n]) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  return q.length;
}

/** Escolhe a direção da cobra `p` para o próximo passo. */
export function chooseSnakeDir(s: SnakeState, p: number, d: Difficulty, rng: () => number): Dir {
  const cfg = SNAKE_AI[d];
  const me = s.snakes[p];
  const cur = me.queue.length ? me.queue[me.queue.length - 1] : me.dir;
  if (rng() < cfg.lapse) return cur;
  const head = xy(me.body[0]);
  const busy = obstacles(s);
  const opp = s.snakes.find((_, k) => k !== p && s.snakes[k].alive);
  const oppHead = opp ? xy(opp.body[0]) : null;
  const options: Array<{ d: Dir; cell: number }> = [];
  for (let k = 0; k < 4; k++) {
    const dd = k as Dir;
    if ((dd + 2) % 4 === me.dir) continue;
    const nx = head.x + DX[dd];
    const ny = head.y + DY[dd];
    if (!inside(nx, ny)) continue;
    const c = idx(nx, ny);
    if (busy[c]) continue;
    options.push({ d: dd, cell: c });
  }
  if (!options.length) return cur;
  const fruits = s.fruits;
  if (cfg.brain === 'greedy') {
    const f = fruits.map(xy).sort((a, b) => Math.abs(a.x - head.x) + Math.abs(a.y - head.y) - (Math.abs(b.x - head.x) + Math.abs(b.y - head.y)))[0];
    if (!f) return options[0].d;
    options.sort((a, b) => {
      const pa = xy(a.cell);
      const pb = xy(b.cell);
      return Math.abs(pa.x - f.x) + Math.abs(pa.y - f.y) - (Math.abs(pb.x - f.x) + Math.abs(pb.y - f.y));
    });
    return options[0].d;
  }
  // cabeça do rival: células vizinhas dela são arriscadas (batida de frente = empate)
  const risky = new Set<number>();
  if (oppHead)
    for (let k = 0; k < 4; k++) {
      const nx = oppHead.x + DX[k];
      const ny = oppHead.y + DY[k];
      if (inside(nx, ny)) risky.add(idx(nx, ny));
    }
  const need = me.body.length + 2;
  // distância real (desviando dos corpos) do rival até cada célula — o Difícil disputa as frutas
  const oppDist = cfg.brain === 'smart' && opp ? bfs(busy, opp.body[0]) : null;
  const scored = options.map((o) => {
    const room = area(busy, o.cell, need * 3);
    const dist = bfs(busy, o.cell);
    let target = Infinity;
    for (const f of fruits) {
      if (dist[f] < 0) continue;
      let dd = dist[f];
      if (oppDist && oppDist[f] >= 0 && oppDist[f] < dd) dd += 20; // ele chega antes: só se não houver outra
      target = Math.min(target, dd);
    }
    let score = 0;
    if (room < need) score -= 1000 - room * 10;
    if (risky.has(o.cell)) score -= 150;
    score -= Number.isFinite(target) ? target * 3 : 60;
    score += Math.min(room, need * 3) * 0.2;
    return { d: o.d, score: score + rng() * 0.1 };
  });
  scored.sort((a, b) => b.score - a.score);
  if (cfg.inertia && rng() < cfg.inertia) {
    const straight = scored.find((x) => x.d === me.dir);
    if (straight && straight.score > -100) return straight.d;
  }
  return scored[0].d;
}

/** Aplica a decisão da IA (usa a mesma função `turn` do humano). */
export function thinkSnake(s: SnakeState, p: number, d: Difficulty, rng: () => number) {
  if (!s.snakes[p]?.alive || s.result !== null) return;
  const dir = chooseSnakeDir(s, p, d, rng);
  s.snakes[p].queue.length = 0;
  turn(s, p, dir);
}
