/**
 * Ludo — regras puras (sem DOM). Tabuleiro clássico 15×15 (cruz com 3 casas de largura).
 * Feito para 2 jogadores agora (cantos opostos) e pronto para 4: cada "assento" tem casa de saída, base e corredor.
 * Regras (as mais comuns no Brasil, simplificadas e mostradas em "Como jogar"):
 * - 4 peões por jogador na base. Só sai da base tirando 6.
 * - Tirou 6, capturou um peão ou levou um peão até o fim: joga de novo. Três 6 seguidos: perde a vez.
 * - Cair numa casa com peão rival manda ele de volta para a base (exceto em casa segura: saídas e estrelas).
 * - Sem barreiras nesta versão: peões juntos não bloqueiam a passagem (regra simplificada, mais rápida no celular).
 * - Para chegar ao centro precisa do número exato. Vence quem levar os 4 peões ao centro.
 * Posição do peão: -1 = base; 0..50 = trilha (relativa à saída do jogador); 51..55 = corredor; 56 = chegou.
 */
export const TRACK_LEN = 52;
export const HOME_COL = 5;
export const FINISH = 56;
export const TOKENS = 4;

/** As 52 casas da trilha em [linha, coluna], no sentido horário. */
export const TRACK: Array<[number, number]> = (() => {
  const t: Array<[number, number]> = [];
  for (let c = 0; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7], [0, 8]);
  for (let r = 1; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14], [8, 14]);
  for (let c = 13; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7], [14, 6]);
  for (let r = 13; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  return t;
})();

export interface Seat {
  /** Índice da casa de saída na trilha. */
  start: number;
  /** Corredor final (5 casas, da entrada até a última antes do centro). */
  home: Array<[number, number]>;
  /** Canto da base: [linha, coluna] do canto superior esquerdo do quadrado 6×6. */
  base: [number, number];
}

/** Assentos: 0 = embaixo à esquerda, 1 = em cima à direita (opostos, usados no 2P); 2 e 3 para o futuro 4P. */
export const SEATS: Seat[] = [
  { start: 40, home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], base: [9, 0] },
  { start: 14, home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], base: [0, 9] },
  { start: 1, home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], base: [0, 0] },
  { start: 27, home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], base: [9, 9] },
];
/** Casas seguras: saídas e estrelas (8 casas depois de cada saída). */
export const SAFE = new Set(SEATS.flatMap((s) => [s.start, (s.start + 8) % TRACK_LEN]));

export interface LudoState {
  /** Quantos jogadores (2 agora; 4 no futuro). Jogador p usa o assento seatOf[p]. */
  players: number;
  seatOf: number[];
  pos: number[][];
  current: number;
  /** Valor do dado da vez (null = ainda não rolou). */
  dice: number | null;
  sixes: number;
  winner: number | null;
  turns: number;
}

export function createLudo(players = 2, first = 0): LudoState {
  const seatOf = players === 2 ? [0, 1] : [0, 2, 1, 3].slice(0, players);
  return { players, seatOf, pos: Array.from({ length: players }, () => Array(TOKENS).fill(-1)), current: first, dice: null, sixes: 0, winner: null, turns: 0 };
}

export const clone = (s: LudoState): LudoState => ({ ...s, seatOf: s.seatOf.slice(), pos: s.pos.map((p) => p.slice()) });

/** Casa absoluta da trilha de um peão (ou -1 se está na base, no corredor ou chegou). */
export function trackIndex(s: LudoState, player: number, p: number): number {
  if (p < 0 || p > 50) return -1;
  return (SEATS[s.seatOf[player]].start + p) % TRACK_LEN;
}

/** Célula [linha, coluna] do tabuleiro onde o peão está (base: casa da base; chegou: centro). */
export function cellOf(s: LudoState, player: number, token: number): [number, number] {
  const seat = SEATS[s.seatOf[player]];
  const p = s.pos[player][token];
  if (p < 0) {
    const [br, bc] = seat.base;
    return [br + 1.5 + (token >> 1) * 3, bc + 1.5 + (token & 1) * 3];
  }
  if (p <= 50) return TRACK[(seat.start + p) % TRACK_LEN];
  if (p < FINISH) return seat.home[p - 51];
  return [7, 7];
}

/** Peões que podem andar com o dado atual. */
export function movable(s: LudoState): number[] {
  if (s.dice === null || s.winner !== null) return [];
  const out: number[] = [];
  s.pos[s.current].forEach((p, t) => {
    if (p === FINISH) return;
    if (p < 0) {
      if (s.dice === 6) out.push(t);
      return;
    }
    if (p + s.dice! <= FINISH) out.push(t);
  });
  return out;
}

export interface MoveResult {
  captured: Array<{ player: number; token: number }>;
  finished: boolean;
  again: boolean;
}

/** Rola o dado. Três 6 seguidos: perde a vez. Sem peão para mover: passa a vez. Devolve se precisa escolher peão. */
export function roll(s: LudoState, value: number): 'choose' | 'pass' | 'forfeit' {
  s.dice = value;
  if (value === 6) s.sixes++;
  if (s.sixes >= 3) {
    endTurn(s, false);
    return 'forfeit';
  }
  if (movable(s).length === 0) {
    endTurn(s, value === 6);
    return 'pass';
  }
  return 'choose';
}

function endTurn(s: LudoState, again: boolean) {
  s.dice = null;
  s.turns++;
  if (!again) {
    s.sixes = 0;
    s.current = (s.current + 1) % s.players;
  }
}

/** Move o peão `token` com o dado atual (use movable para saber os válidos). */
export function moveToken(s: LudoState, token: number): MoveResult {
  const d = s.dice!;
  const me = s.current;
  const p = s.pos[me][token];
  const np = p < 0 ? 0 : p + d;
  s.pos[me][token] = np;
  const captured: MoveResult['captured'] = [];
  const ti = trackIndex(s, me, np);
  if (ti >= 0 && !SAFE.has(ti)) {
    for (let o = 0; o < s.players; o++) {
      if (o === me) continue;
      s.pos[o].forEach((op, ot) => {
        if (trackIndex(s, o, op) === ti) {
          s.pos[o][ot] = -1;
          captured.push({ player: o, token: ot });
        }
      });
    }
  }
  const finished = np === FINISH;
  if (s.pos[me].every((x) => x === FINISH)) s.winner = me;
  const again = s.winner === null && (d === 6 || captured.length > 0 || finished);
  endTurn(s, again);
  return { captured, finished, again };
}

/** Quantas casas faltam para todos os peões chegarem (medida de quem está na frente). */
export function remaining(s: LudoState, player: number) {
  return s.pos[player].reduce((sum, p) => sum + (p < 0 ? FINISH + 6 : FINISH - p), 0);
}
