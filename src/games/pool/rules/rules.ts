import type { ShotEvent } from '../physics/world';

export type Group = 'solids' | 'stripes';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Mode = 'ai' | 'local';
export type BallInHand = 'none' | 'kitchen' | 'anywhere';

export interface PlayerState {
  name: string;
  isAI: boolean;
  group: Group | null;
}

export interface MatchState {
  mode: Mode;
  difficulty: Difficulty;
  players: [PlayerState, PlayerState];
  current: 0 | 1;
  breaker: 0 | 1;
  isBreak: boolean;
  tableOpen: boolean;
  ballInHand: BallInHand;
  /** Caçapa cantada para a bola 8 (obrigatória quando o jogador está na 8). */
  calledPocket: number | null;
  winner: 0 | 1 | null;
  winReason: string;
  lastFoul: string | null;
  lastMessage: string;
  shotCount: number;
}

export interface ShotSummary {
  firstContact: number | null;
  pocketed: Array<{ ball: number; pocket: number }>;
  /** Alguma bola (branca ou objeto) tocou tabela depois do primeiro contato. */
  railAfterContact: boolean;
  /** Bolas-objeto distintas que tocaram tabela (critério de abertura legal). */
  objectBallsToRail: number;
  cueScratch: boolean;
}

export interface ShotResult {
  state: MatchState;
  respotEight: boolean;
  /** Turno manteve-se com o mesmo jogador. */
  continued: boolean;
  foul: string | null;
}

export const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];

export function groupOf(ball: number): Group | 'eight' | 'cue' {
  if (ball === 0) return 'cue';
  if (ball === 8) return 'eight';
  return ball < 8 ? 'solids' : 'stripes';
}

export const groupBalls = (g: Group) => (g === 'solids' ? SOLIDS : STRIPES);
export const groupLabel = (g: Group | null) => (g === 'solids' ? 'Lisas (1–7)' : g === 'stripes' ? 'Listradas (9–15)' : 'Mesa aberta');
const other = (g: Group): Group => (g === 'solids' ? 'stripes' : 'solids');

export function createMatch(opts: {
  mode: Mode;
  difficulty?: Difficulty;
  names?: [string, string];
  breaker?: 0 | 1;
}): MatchState {
  const mode = opts.mode;
  const names = opts.names ?? (mode === 'ai' ? ['Você', 'IA'] : ['Jogador 1', 'Jogador 2']);
  const breaker = opts.breaker ?? 0;
  return {
    mode,
    difficulty: opts.difficulty ?? 'medium',
    players: [
      { name: names[0] || 'Jogador 1', isAI: false, group: null },
      { name: names[1] || (mode === 'ai' ? 'IA' : 'Jogador 2'), isAI: mode === 'ai', group: null },
    ],
    current: breaker,
    breaker,
    isBreak: true,
    tableOpen: true,
    ballInHand: 'kitchen',
    calledPocket: null,
    winner: null,
    winReason: '',
    lastFoul: null,
    lastMessage: 'Abertura: posicione a branca atrás da linha de cabeceira.',
    shotCount: 0,
  };
}

/** O jogador já encaçapou todas as bolas do seu grupo e deve jogar na 8. */
export function isOnEight(state: MatchState, player: 0 | 1, onTable: number[]): boolean {
  const g = state.players[player].group;
  if (!g || state.tableOpen) return false;
  return groupBalls(g).every((b) => !onTable.includes(b));
}

/** Bolas que o jogador pode tocar primeiro legalmente. */
export function legalTargets(state: MatchState, player: 0 | 1, onTable: number[]): number[] {
  const objs = onTable.filter((b) => b !== 0);
  if (state.isBreak) return objs;
  if (state.tableOpen || !state.players[player].group) return objs.filter((b) => b !== 8);
  if (isOnEight(state, player, onTable)) return objs.filter((b) => b === 8);
  const gb = groupBalls(state.players[player].group!);
  return objs.filter((b) => gb.includes(b));
}

export function summarizeShot(events: ShotEvent[]): ShotSummary {
  let firstContact: number | null = null;
  let railAfterContact = false;
  const railBalls = new Set<number>();
  const pocketed: Array<{ ball: number; pocket: number }> = [];
  for (const e of events) {
    if (e.type === 'ball') {
      if (firstContact === null && (e.a === 0 || e.b === 0)) firstContact = e.a === 0 ? e.b : e.a;
    } else if (e.type === 'cushion') {
      if (firstContact !== null) railAfterContact = true;
      if (e.ball !== 0) railBalls.add(e.ball);
    } else if (e.type === 'pocket') {
      pocketed.push({ ball: e.ball, pocket: e.pocket });
    }
  }
  return {
    firstContact,
    pocketed,
    railAfterContact,
    objectBallsToRail: railBalls.size,
    cueScratch: pocketed.some((p) => p.ball === 0),
  };
}

/**
 * Avalia uma tacada concluída (todas as bolas paradas) segundo a variante documentada em RULES.md.
 * `onTableBefore`: bolas na mesa ANTES da tacada (inclui a branca).
 */
export function evaluateShot(prev: MatchState, sum: ShotSummary, onTableBefore: number[], ): ShotResult {
  const s: MatchState = {
    ...prev,
    players: [{ ...prev.players[0] }, { ...prev.players[1] }],
    shotCount: prev.shotCount + 1,
    lastFoul: null,
  };
  const me = prev.current;
  const opp = (1 - me) as 0 | 1;
  const myName = prev.players[me].name;
  const pocketedObj = sum.pocketed.map((p) => p.ball).filter((b) => b !== 0);
  const eightIn = pocketedObj.includes(8);
  const startOn8 = isOnEight(prev, me, onTableBefore);
  const myGroup = prev.players[me].group;

  // ---- Faltas ----
  let foul: string | null = null;
  if (sum.firstContact === null) foul = 'a branca não tocou nenhuma bola';
  else if (!prev.isBreak) {
    if (prev.tableOpen) {
      if (sum.firstContact === 8) foul = 'com a mesa aberta, a 8 não pode ser a primeira bola tocada';
    } else if (startOn8) {
      if (sum.firstContact !== 8) foul = 'era obrigatório tocar a bola 8 primeiro';
    } else if (sum.firstContact === 8 || groupOf(sum.firstContact) !== myGroup) {
      foul = sum.firstContact === 8 ? 'tocou a bola 8 primeiro' : 'tocou primeiro uma bola do adversário';
    }
  }
  if (!foul && sum.cueScratch) foul = 'bola branca encaçapada';
  if (!foul && !prev.isBreak && sum.pocketed.length === 0 && !sum.railAfterContact) {
    foul = 'nenhuma bola tocou a tabela após o contato';
  }
  if (!foul && prev.isBreak && pocketedObj.length === 0 && sum.objectBallsToRail < 4) {
    foul = 'abertura ilegal (nenhuma bola encaçapada e menos de 4 bolas na tabela)';
  }

  const result = (continued: boolean, respotEight = false): ShotResult => {
    s.isBreak = false;
    s.calledPocket = null;
    if (foul) {
      s.lastFoul = foul;
      s.ballInHand = 'anywhere';
      s.current = opp;
    } else {
      s.ballInHand = 'none';
      s.current = continued ? me : opp;
    }
    return { state: s, respotEight, continued: !foul && continued, foul };
  };

  // ---- Bola 8 ----
  if (eightIn) {
    if (prev.isBreak) {
      s.lastMessage = foul
        ? `Falta na abertura (${foul}). A 8 volta ao ponto do pé. Bola na mão para ${prev.players[opp].name}.`
        : `A 8 caiu na abertura e volta ao ponto do pé. ${myName} continua.`;
      return result(true, true);
    }
    const eightPocket = sum.pocketed.find((p) => p.ball === 8)!.pocket;
    const lose = (why: string) => {
      s.winner = opp;
      s.winReason = `${myName} perdeu: ${why}.`;
      s.lastMessage = s.winReason;
      return result(false);
    };
    if (!startOn8) return lose('encaçapou a 8 antes de terminar o seu grupo');
    if (foul) return lose(`encaçapou a 8 cometendo falta (${foul})`);
    if (prev.calledPocket === null || eightPocket !== prev.calledPocket) return lose('a 8 caiu em caçapa diferente da cantada');
    s.winner = me;
    s.winReason = `${myName} encaçapou a 8 na caçapa cantada e venceu!`;
    s.lastMessage = s.winReason;
    return result(false);
  }

  if (foul) {
    s.lastMessage = `Falta de ${myName}: ${foul}. Bola na mão para ${prev.players[opp].name}.`;
    return result(false);
  }

  // ---- Definição de grupos (somente após a abertura, com mesa aberta) ----
  if (prev.isBreak) {
    if (pocketedObj.length > 0) {
      s.lastMessage = `${myName} encaçapou na abertura e continua. Mesa aberta.`;
      return result(true);
    }
    s.lastMessage = `Abertura válida. Vez de ${prev.players[opp].name}. Mesa aberta.`;
    return result(false);
  }

  if (prev.tableOpen) {
    const first = pocketedObj.find((b) => b !== 8);
    if (first !== undefined) {
      const g = groupOf(first) as Group;
      s.players[me].group = g;
      s.players[opp].group = other(g);
      s.tableOpen = false;
      s.lastMessage = `${myName} fica com as ${g === 'solids' ? 'lisas' : 'listradas'} e continua.`;
      return result(true);
    }
    s.lastMessage = `Nenhuma bola encaçapada. Vez de ${prev.players[opp].name}.`;
    return result(false);
  }

  const mine = groupBalls(myGroup!);
  if (pocketedObj.some((b) => mine.includes(b))) {
    s.lastMessage = `${myName} encaçapou e continua.`;
    return result(true);
  }
  s.lastMessage = `Vez de ${prev.players[opp].name}.`;
  return result(false);
}

/**
 * Tempo da tacada esgotado: é falta. Na abertura, a vez passa e o adversário abre
 * (bola na mão atrás da linha de cabeceira); fora dela, bola na mão em qualquer lugar.
 */
export function timeoutFoul(prev: MatchState): MatchState {
  const me = prev.current;
  const opp = (1 - me) as 0 | 1;
  const foul = 'tempo da tacada esgotado';
  return {
    ...prev,
    players: [{ ...prev.players[0] }, { ...prev.players[1] }],
    current: opp,
    breaker: prev.isBreak ? opp : prev.breaker,
    ballInHand: prev.isBreak ? 'kitchen' : 'anywhere',
    calledPocket: null,
    lastFoul: foul,
    lastMessage: `Falta de ${prev.players[me].name}: ${foul}. ${prev.isBreak ? `${prev.players[opp].name} faz a abertura.` : `Bola na mão para ${prev.players[opp].name}.`}`,
  };
}
