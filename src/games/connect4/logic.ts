/**
 * Lig-4 — regras puras (sem DOM). Grade 7 colunas × 6 linhas; a peça cai até a posição livre mais baixa.
 * Vence quem alinhar 4 (horizontal, vertical ou diagonal). Grade cheia sem 4 = empate.
 */
export const COLS = 7;
export const ROWS = 6;

export interface C4State {
  /** cells[c][r]: r = 0 é a linha de baixo. 0 vazio, 1 = J1, 2 = J2. */
  cells: number[][];
  current: 0 | 1;
  winner: 0 | 1 | 'draw' | null;
  /** Casas da linha vencedora. */
  line: Array<[number, number]>;
  moves: number[];
}

export function createC4(first: 0 | 1 = 0): C4State {
  return { cells: Array.from({ length: COLS }, () => Array(ROWS).fill(0)), current: first, winner: null, line: [], moves: [] };
}

export const height = (s: C4State, c: number) => {
  const col = s.cells[c];
  let h = 0;
  while (h < ROWS && col[h] !== 0) h++;
  return h;
};

export const canPlay = (s: C4State, c: number) => s.winner === null && c >= 0 && c < COLS && s.cells[c][ROWS - 1] === 0;

export const validCols = (s: C4State) => [...Array(COLS).keys()].filter((c) => canPlay(s, c));

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Linha de 4 que passa por (c, r), se houver. */
export function lineAt(s: C4State, c: number, r: number): Array<[number, number]> | null {
  const v = s.cells[c][r];
  if (!v) return null;
  for (const [dc, dr] of DIRS) {
    const pts: Array<[number, number]> = [[c, r]];
    for (const sg of [1, -1]) {
      let x = c + dc * sg;
      let y = r + dr * sg;
      while (x >= 0 && x < COLS && y >= 0 && y < ROWS && s.cells[x][y] === v) {
        pts.push([x, y]);
        x += dc * sg;
        y += dr * sg;
      }
    }
    if (pts.length >= 4) return pts;
  }
  return null;
}

/** Joga na coluna. Retorna a linha onde a peça parou, ou -1 se a jogada é inválida. */
export function play(s: C4State, c: number): number {
  if (!canPlay(s, c)) return -1;
  const r = height(s, c);
  s.cells[c][r] = s.current + 1;
  s.moves.push(c);
  const l = lineAt(s, c, r);
  if (l) {
    s.winner = s.current;
    s.line = l;
  } else if (s.moves.length === COLS * ROWS) s.winner = 'draw';
  else s.current = (1 - s.current) as 0 | 1;
  return r;
}

/** Desfaz a última jogada (usado pela IA). */
export function undo(s: C4State): void {
  const c = s.moves.pop();
  if (c === undefined) return;
  const r = height(s, c) - 1;
  const who = s.cells[c][r] - 1;
  s.cells[c][r] = 0;
  s.current = who as 0 | 1;
  s.winner = null;
  s.line = [];
}

export const cloneC4 = (s: C4State): C4State => ({ cells: s.cells.map((c) => [...c]), current: s.current, winner: s.winner, line: [...s.line], moves: [...s.moves] });
