import type { Vec } from '../physics/types';

/** Regras do minigolfe (puras, testáveis). Ver GAME_DESIGN.md. */
export const MAX_STROKES = 10;
export const OUT_PENALTY = 1;

export type GolfMode = 'solo' | 'duo';

export interface PlayerHole {
  strokes: number;
  pos: Vec;
  /** Último ponto seguro (onde a bola parou dentro do campo). */
  safe: Vec;
  done: boolean;
}

export interface GolfPlayer {
  name: string;
  /** Tacadas por buraco jogado (índice = posição em `holes`); null = ainda não jogou. */
  scores: (number | null)[];
}

export interface GolfMatch {
  mode: GolfMode;
  /** Índices das fases desta partida (circuito completo em ordem sorteada ou treino de 1). */
  holes: number[];
  holeIdx: number;
  players: GolfPlayer[];
  ph: PlayerHole[];
  current: number;
  /** Quem tacou primeiro no buraco 1 (05/11: sorteado). Depois a saída alterna a cada buraco. */
  first: number;
  finished: boolean;
  lastMessage: string;
}

export function createMatch(mode: GolfMode, names: string[], holes: number[], tee: Vec, first = 0): GolfMatch {
  const players = (mode === 'solo' ? names.slice(0, 1) : names.slice(0, 2)).map((name) => ({ name, scores: holes.map(() => null) }));
  const m: GolfMatch = { mode, holes, holeIdx: 0, players, ph: [], current: 0, first: first % players.length, finished: false, lastMessage: '' };
  return startHole(m, tee);
}

/** Quem sai neste buraco: alterna a cada buraco a partir do sorteado (ninguém sai sempre primeiro). */
export const starter = (m: GolfMatch) => (m.first + m.holeIdx) % m.players.length;

export function startHole(m: GolfMatch, tee: Vec): GolfMatch {
  return {
    ...m,
    ph: m.players.map(() => ({ strokes: 0, pos: { ...tee }, safe: { ...tee }, done: false })),
    current: starter(m),
    lastMessage: `Buraco ${m.holeIdx + 1}. Vez de ${m.players[starter(m)].name}.`,
  };
}

export type ShotOutcome = { kind: 'holed' } | { kind: 'rest'; pos: Vec } | { kind: 'out' };

/** Registra uma tacada do jogador da vez e decide a próxima vez. */
export function applyShot(m: GolfMatch, outcome: ShotOutcome): GolfMatch {
  const ph = m.ph.map((p) => ({ ...p, pos: { ...p.pos }, safe: { ...p.safe } }));
  const players = m.players.map((p) => ({ ...p, scores: [...p.scores] }));
  const me = ph[m.current];
  const name = players[m.current].name;
  me.strokes += 1;
  let msg = '';
  if (outcome.kind === 'holed') {
    me.done = true;
    msg = me.strokes === 1 ? `${name}: buraco em uma!` : `${name} acertou o buraco em ${me.strokes} tacadas.`;
  } else if (outcome.kind === 'out') {
    me.strokes += OUT_PENALTY;
    me.pos = { ...me.safe };
    msg = `${name}: bola fora de campo. Volta ao último ponto seguro com +${OUT_PENALTY} tacada de penalidade.`;
  } else {
    me.pos = { ...outcome.pos };
    me.safe = { ...outcome.pos };
  }
  if (!me.done && me.strokes >= MAX_STROKES) {
    me.strokes = MAX_STROKES;
    me.done = true;
    msg = `${name} chegou ao limite de ${MAX_STROKES} tacadas neste buraco.`;
  }
  if (me.done) {
    me.strokes = Math.min(me.strokes, MAX_STROKES);
    players[m.current].scores[m.holeIdx] = me.strokes;
  }
  const next = nextPlayer(ph, m.current);
  if (next !== null && next !== m.current && !msg) msg = `Vez de ${players[next].name}.`;
  return { ...m, ph, players, current: next ?? m.current, lastMessage: msg };
}

/** No 2P os jogadores alternam tacadas; quem já terminou o buraco é pulado. */
function nextPlayer(ph: PlayerHole[], cur: number): number | null {
  if (ph.every((p) => p.done)) return null;
  for (let k = 1; k <= ph.length; k++) {
    const i = (cur + k) % ph.length;
    if (!ph[i].done) return i;
  }
  return null;
}

export const holeComplete = (m: GolfMatch) => m.ph.every((p) => p.done);

/** Vai para o próximo buraco (ou encerra a partida). */
export function advance(m: GolfMatch, nextTee: Vec | null): GolfMatch {
  if (m.holeIdx + 1 >= m.holes.length || !nextTee) return { ...m, finished: true, lastMessage: 'Fim da partida.' };
  return startHole({ ...m, holeIdx: m.holeIdx + 1 }, nextTee);
}

export const total = (p: GolfPlayer) => p.scores.reduce<number>((s, x) => s + (x ?? 0), 0);

export interface MatchResult {
  totals: number[];
  /** Índice do vencedor, ou null em empate. */
  winner: number | null;
  /** Como foi decidido. */
  reason: 'total' | 'last3' | 'draw' | 'solo';
}

/** Menor total vence; empate → menor soma dos 3 últimos buracos; persistindo, empate. */
export function result(m: GolfMatch): MatchResult {
  const totals = m.players.map(total);
  if (m.players.length === 1) return { totals, winner: 0, reason: 'solo' };
  if (totals[0] !== totals[1]) return { totals, winner: totals[0] < totals[1] ? 0 : 1, reason: 'total' };
  const last3 = m.players.map((p) => p.scores.slice(-3).reduce<number>((s, x) => s + (x ?? 0), 0));
  if (last3[0] !== last3[1]) return { totals, winner: last3[0] < last3[1] ? 0 : 1, reason: 'last3' };
  return { totals, winner: null, reason: 'draw' };
}
