/**
 * IA dos Blocos (04/11). Não vê o futuro: decide só com a bandeja atual, como o jogador.
 * Cada jogada possível é avaliada por linhas limpas + qualidade da grade que sobra (espaço livre, buracos
 * isolados, "serrilhado" e quantas peças do catálogo ainda cabem).
 * - Fácil: como o Médio, mas em 30% das jogadas sorteia entre as razoáveis (às vezes escolhe mal).
 * - Médio: melhor jogada de uma peça por vez.
 * - Difícil: planeja a ordem das peças da bandeja (até 3 em sequência, com poda) antes de jogar a primeira;
 *   em 6% das jogadas se distrai (sem isso a partida dele nunca acabava e ninguém conseguia vencer).
 * Medido em tests/bench/blocks-ai.ts (pontos até acabar o espaço).
 */
import type { Difficulty } from '../shared/shell';
import { BlocksState, canPlace, N, Shape, SHAPES } from './logic';

export interface BlocksMove {
  idx: number;
  r: number;
  c: number;
}

function simPlace(grid: Uint8Array, shape: Shape, r: number, c: number): { g: Uint8Array; lines: number } {
  const g = grid.slice();
  for (const [dr, dc] of shape.cells) g[(r + dr) * N + c + dc] = 1;
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < N; i++) {
    let rf = true;
    let cf = true;
    for (let j = 0; j < N; j++) {
      if (!g[i * N + j]) rf = false;
      if (!g[j * N + i]) cf = false;
    }
    if (rf) rows.push(i);
    if (cf) cols.push(i);
  }
  for (const row of rows) for (let j = 0; j < N; j++) g[row * N + j] = 0;
  for (const col of cols) for (let j = 0; j < N; j++) g[j * N + col] = 0;
  return { g, lines: rows.length + cols.length };
}

/** Peças distintas do catálogo (sem repetir rotação) usadas para medir "ainda cabe muita coisa". */
const PROBE = SHAPES.filter((s) => ['o3', 'i50', 'i51', 'i40', 'i41', 'r230', 'r231', 'v50', 'o2'].includes(s.id));

export function boardQuality(g: Uint8Array): number {
  let empty = 0;
  let isolated = 0;
  let rough = 0;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = g[r * N + c];
      if (!v) {
        empty++;
        let blocked = 0;
        if (r === 0 || g[(r - 1) * N + c]) blocked++;
        if (r === N - 1 || g[(r + 1) * N + c]) blocked++;
        if (c === 0 || g[r * N + c - 1]) blocked++;
        if (c === N - 1 || g[r * N + c + 1]) blocked++;
        if (blocked === 4) isolated++;
      }
      if (c < N - 1 && !!v !== !!g[r * N + c + 1]) rough++;
      if (r < N - 1 && !!v !== !!g[(r + 1) * N + c]) rough++;
    }
  let fits = 0;
  for (const sh of PROBE) {
    let ok = false;
    for (let r = 0; r <= N - sh.h && !ok; r++) for (let c = 0; c <= N - sh.w && !ok; c++) if (canPlace(g, sh, r, c)) ok = true;
    if (ok) fits++;
  }
  return empty * 1.0 - isolated * 6 - rough * 0.6 + fits * 4;
}

interface Cand {
  idx: number;
  r: number;
  c: number;
  g: Uint8Array;
  v: number;
}

function candidates(grid: Uint8Array, tray: (Shape | null)[]): Cand[] {
  const out: Cand[] = [];
  tray.forEach((sh, idx) => {
    if (!sh) return;
    for (let r = 0; r <= N - sh.h; r++)
      for (let c = 0; c <= N - sh.w; c++) {
        if (!canPlace(grid, sh, r, c)) continue;
        const { g, lines } = simPlace(grid, sh, r, c);
        out.push({ idx, r, c, g, v: lines * lines * 12 + lines * 10 + boardQuality(g) });
      }
  });
  return out.sort((a, b) => b.v - a.v);
}

/** Melhor valor alcançável jogando as peças restantes (busca com poda: só as `beam` melhores por nível). */
function plan(grid: Uint8Array, tray: (Shape | null)[], beam: number): number {
  const cs = candidates(grid, tray);
  if (!cs.length) return tray.some(Boolean) ? -500 : boardQuality(grid);
  let best = -Infinity;
  for (const c of cs.slice(0, beam)) {
    const rest = tray.slice();
    rest[c.idx] = null;
    const v = rest.some(Boolean) ? plan(c.g, rest, beam) + (c.v - boardQuality(c.g)) : c.v;
    if (v > best) best = v;
  }
  return best;
}

export const HARD_LAPSE = 0.06;
export const EASY_LAPSE = 0.3;

export function chooseBlocks(s: BlocksState, d: Difficulty, rng: () => number): BlocksMove | null {
  const tray = s.tray.map((p) => (p ? p.shape : null));
  const cs = candidates(s.grid, tray);
  if (!cs.length) return null;
  if (d === 'easy' && rng() < EASY_LAPSE) {
    // erra de propósito: sorteia entre as jogadas até 15 pontos piores que a melhor
    const ok = cs.filter((c) => c.v >= cs[0].v - 15);
    const c = ok[Math.floor(rng() * ok.length)];
    return { idx: c.idx, r: c.r, c: c.c };
  }
  if (d !== 'hard') return { idx: cs[0].idx, r: cs[0].r, c: cs[0].c };
  // Difícil também se distrai de vez em quando (sem isso nunca perdia: a partida não acabava)
  if (rng() < HARD_LAPSE) {
    const ok = cs.filter((c) => c.v >= cs[0].v - 20);
    const c = ok[Math.floor(rng() * ok.length)];
    return { idx: c.idx, r: c.r, c: c.c };
  }
  let best = cs[0];
  let bestV = -Infinity;
  for (const c of cs.slice(0, 8)) {
    const rest = tray.slice();
    rest[c.idx] = null;
    const v = rest.some(Boolean) ? plan(c.g, rest, 4) + (c.v - boardQuality(c.g)) : c.v;
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return { idx: best.idx, r: best.r, c: best.c };
}
