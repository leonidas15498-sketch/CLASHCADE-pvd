/**
 * Blocos Cromáticos — regras puras (sem DOM). Grade 8×8, bandeja com 3 peças; ao usar as 3, vêm outras 3.
 * Linha ou coluna completa some. Acaba quando nenhuma peça da bandeja cabe na grade.
 *
 * Pontuação (documentada em docs/jogos/blocos.md):
 * - Colocar peça: +1 por quadradinho.
 * - Limpar L linhas/colunas na mesma jogada: 10 · L·(L+1)/2  (1 → 10, 2 → 30, 3 → 60, 4 → 100…).
 * - Combo: cada jogada que limpa soma 1 à sequência; o multiplicador é 1 + 0,5·(sequência − 1), no máximo ×5.
 *   A sequência só zera depois de 3 jogadas seguidas sem limpar (dá para "preparar" a próxima linha).
 * - Grade vazia depois de limpar: +300 (sem multiplicador).
 */
export const N = 8;
export const TRAY = 3;
export const COLORS = 7;

export interface Shape {
  id: string;
  /** [linha, coluna] a partir do canto superior esquerdo. */
  cells: [number, number][];
  w: number;
  h: number;
  /** Peso no sorteio. */
  weight: number;
}

const mk = (id: string, rows: string[], weight: number): Shape => {
  const cells: [number, number][] = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && cells.push([r, c])));
  return { id, cells, w: Math.max(...rows.map((x) => x.length)), h: rows.length, weight };
};

/** Todas as rotações distintas de um desenho. */
function rotations(id: string, rows: string[], totalWeight: number): Shape[] {
  const out: string[][] = [];
  let cur = rows;
  for (let i = 0; i < 4; i++) {
    const key = cur.join('/');
    if (!out.some((o) => o.join('/') === key)) out.push(cur);
    // gira 90° no sentido horário
    const h = cur.length;
    const w = Math.max(...cur.map((x) => x.length));
    const nxt: string[] = [];
    for (let c = 0; c < w; c++) {
      let line = '';
      for (let r = h - 1; r >= 0; r--) line += cur[r][c] ?? '.';
      nxt.push(line);
    }
    cur = nxt;
  }
  return out.map((r, i) => mk(out.length > 1 ? `${id}${i}` : id, r, totalWeight / out.length));
}

/** Catálogo de peças. Pesos = chance relativa da família (hipótese inicial; ajustar jogando). */
export const SHAPES: Shape[] = [
  ...rotations('p1', ['#'], 3),
  ...rotations('i2', ['##'], 5),
  ...rotations('i3', ['###'], 6),
  ...rotations('i4', ['####'], 5),
  ...rotations('i5', ['#####'], 3),
  ...rotations('o2', ['##', '##'], 7),
  ...rotations('o3', ['###', '###', '###'], 2.5),
  ...rotations('r23', ['###', '###'], 4),
  ...rotations('v3', ['##', '#.'], 6),
  ...rotations('l4', ['#.', '#.', '##'], 5),
  ...rotations('j4', ['.#', '.#', '##'], 5),
  ...rotations('t4', ['###', '.#.'], 5),
  ...rotations('s4', ['.##', '##.'], 3.5),
  ...rotations('z4', ['##.', '.##'], 3.5),
  ...rotations('v5', ['#..', '#..', '###'], 3),
];
export const shapeById = (id: string) => SHAPES.find((s) => s.id === id);

export interface Piece {
  shape: Shape;
  color: number;
  uid: number;
}

export interface BlocksState {
  /** 0 = vazio; 1..COLORS = cor. Índice r*N+c. */
  grid: Uint8Array;
  tray: (Piece | null)[];
  score: number;
  /** Jogadas seguidas que limparam (combo). */
  streak: number;
  /** Jogadas desde a última limpeza. */
  sinceClear: number;
  moves: number;
  lines: number;
  bestStreak: number;
  over: boolean;
  rng: () => number;
  nextUid: number;
}

export interface PlaceResult {
  rows: number[];
  cols: number[];
  placePts: number;
  clearPts: number;
  mult: number;
  streak: number;
  boardClear: boolean;
  total: number;
  /** Quadradinhos que sumiram, com a cor (para a animação). */
  clearedCells: { r: number; c: number; color: number }[];
}

export function makeRng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clearPoints = (lines: number) => (10 * lines * (lines + 1)) / 2;
export const comboMult = (streak: number) => Math.min(5, 1 + 0.5 * Math.max(0, streak - 1));
export const BOARD_CLEAR_BONUS = 300;
/** Jogadas sem limpar até o combo zerar. */
export const COMBO_GRACE = 3;

export function canPlace(grid: Uint8Array, shape: Shape, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r + shape.h > N || c + shape.w > N) return false;
  for (const [dr, dc] of shape.cells) if (grid[(r + dr) * N + c + dc]) return false;
  return true;
}

export function fitsAnywhere(grid: Uint8Array, shape: Shape): boolean {
  for (let r = 0; r <= N - shape.h; r++) for (let c = 0; c <= N - shape.w; c++) if (canPlace(grid, shape, r, c)) return true;
  return false;
}

/** Linhas e colunas que ficariam completas se a peça fosse colocada ali (para destacar na prévia). */
export function wouldClear(grid: Uint8Array, shape: Shape, r: number, c: number): { rows: number[]; cols: number[] } {
  const g = grid.slice();
  for (const [dr, dc] of shape.cells) g[(r + dr) * N + c + dc] = 1;
  return fullLines(g);
}

function fullLines(g: Uint8Array) {
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
  return { rows, cols };
}

function pickShape(rng: () => number): Shape {
  const total = SHAPES.reduce((a, s) => a + s.weight, 0);
  let x = rng() * total;
  for (const s of SHAPES) {
    x -= s.weight;
    if (x <= 0) return s;
  }
  return SHAPES[SHAPES.length - 1];
}

/**
 * Nova bandeja. Justiça: tenta até 30 sorteios para que pelo menos UMA peça caiba na grade atual; se nenhum
 * sorteio servir, troca uma peça pela maior que cabe. Nunca se perde ao receber a bandeja; perde-se depois,
 * ao não conseguir encaixar as outras — é o jogo.
 */
export function refill(s: BlocksState) {
  let tray: Piece[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    tray = [];
    for (let i = 0; i < TRAY; i++) tray.push({ shape: pickShape(s.rng), color: 1 + Math.floor(s.rng() * COLORS), uid: s.nextUid++ });
    if (tray.some((p) => fitsAnywhere(s.grid, p.shape))) break;
  }
  if (!tray.some((p) => fitsAnywhere(s.grid, p.shape))) {
    // último recurso: troca uma peça sorteada pela maior que ainda cabe (grade quase cheia)
    const fit = [...SHAPES].sort((a, b) => b.cells.length - a.cells.length).find((sh) => fitsAnywhere(s.grid, sh));
    if (fit) tray[Math.floor(s.rng() * TRAY)].shape = fit;
  }
  s.tray = tray;
}

export function createBlocks(seed = (Math.random() * 2 ** 31) | 0): BlocksState {
  const s: BlocksState = {
    grid: new Uint8Array(N * N),
    tray: [],
    score: 0,
    streak: 0,
    sinceClear: 0,
    moves: 0,
    lines: 0,
    bestStreak: 0,
    over: false,
    rng: makeRng(seed),
    nextUid: 1,
  };
  refill(s);
  return s;
}

export function hasMove(s: BlocksState): boolean {
  return s.tray.some((p) => p && fitsAnywhere(s.grid, p.shape));
}

/** Coloca a peça `idx` da bandeja com o canto superior esquerdo em (r, c). null = jogada inválida (nada muda). */
export function place(s: BlocksState, idx: number, r: number, c: number): PlaceResult | null {
  const p = s.tray[idx];
  if (s.over || !p || !canPlace(s.grid, p.shape, r, c)) return null;
  for (const [dr, dc] of p.shape.cells) s.grid[(r + dr) * N + c + dc] = p.color;
  s.tray[idx] = null;
  s.moves++;
  const { rows, cols } = fullLines(s.grid);
  const L = rows.length + cols.length;
  const clearedCells: PlaceResult['clearedCells'] = [];
  if (L) {
    const seen = new Set<number>();
    const take = (i: number) => {
      if (seen.has(i)) return;
      seen.add(i);
      clearedCells.push({ r: Math.floor(i / N), c: i % N, color: s.grid[i] });
    };
    for (const row of rows) for (let j = 0; j < N; j++) take(row * N + j);
    for (const col of cols) for (let j = 0; j < N; j++) take(j * N + col);
    for (const i of seen) s.grid[i] = 0;
    s.streak++;
    s.sinceClear = 0;
    s.lines += L;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.sinceClear++;
    if (s.sinceClear >= COMBO_GRACE) s.streak = 0;
  }
  const placePts = p.shape.cells.length;
  const mult = L ? comboMult(s.streak) : 1;
  const clearPts = L ? Math.round(clearPoints(L) * mult) : 0;
  const boardClear = L > 0 && s.grid.every((v) => v === 0);
  const total = placePts + clearPts + (boardClear ? BOARD_CLEAR_BONUS : 0);
  s.score += total;
  if (s.tray.every((x) => x === null)) refill(s);
  if (!hasMove(s)) s.over = true;
  return { rows, cols, placePts, clearPts, mult, streak: s.streak, boardClear, total, clearedCells };
}

/** Faixas de pontuação (calibradas pelo robô em tests/bench/blocks.ts; ver docs/jogos/blocos.md). */
export const TIERS = [
  { name: 'Bronze', min: 300, color: '#d08a4f' },
  { name: 'Prata', min: 1000, color: '#c9d3e0' },
  { name: 'Ouro', min: 2500, color: '#ffc93c' },
  { name: 'Diamante', min: 6000, color: '#7fe7ff' },
] as const;

export function tierOf(score: number) {
  let t: (typeof TIERS)[number] | null = null;
  for (const x of TIERS) if (score >= x.min) t = x;
  return t;
}
export function nextTier(score: number) {
  return TIERS.find((x) => score < x.min) ?? null;
}
