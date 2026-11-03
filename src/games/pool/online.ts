import type { GameController } from './game/controller';
import type { BallInHand, Group, MatchState } from './rules/rules';

/**
 * Sinuca online — formato do estado gravado na sala (coluna `state`).
 *
 * Quem taca simula a tacada no próprio aparelho e envia:
 *  - `balls`: posição final de cada bola (números completos, sem arredondar: JSON preserva o double exato);
 *  - `shot`: a mesa logo antes do impulso (`from`) e as velocidades da branca depois do impulso (`cue`).
 * O outro aparelho repete a física a partir de `from` + `cue` (mesmo motor, passo fixo) só para ANIMAR,
 * e no fim usa `balls`/`match` deste pacote como verdade (se o replay divergir por arredondamento, encaixa).
 */
export interface NetBall {
  id: number; x: number; y: number; p: 0 | 1; pk: number;
  /** Orientação (só visual), 4 casas. */
  q: [number, number, number, number];
}
export interface NetShot { from: NetBall[]; cue: [number, number, number, number, number]; }
export interface PoolNetState {
  v: 1;
  balls: NetBall[];
  match: NetMatch;
  pocket: number[];
  shot: NetShot | null;
}
/** Só o que as regras precisam; nomes vêm da sala. */
export interface NetMatch {
  current: 0 | 1; breaker: 0 | 1; isBreak: boolean; tableOpen: boolean; ballInHand: BallInHand;
  calledPocket: number | null; winner: 0 | 1 | null; winReason: string; lastFoul: string | null;
  lastMessage: string; shotCount: number; groups: [Group | null, Group | null];
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function encodeBalls(g: GameController): NetBall[] {
  return g.world.balls.map((b) => ({
    id: b.id, x: b.x, y: b.y, p: b.pocketed ? 1 : 0, pk: b.pocketId ?? -1,
    q: [r4(b.q[0]), r4(b.q[1]), r4(b.q[2]), r4(b.q[3])],
  }));
}

export function encodeMatch(m: MatchState): NetMatch {
  return {
    current: m.current, breaker: m.breaker, isBreak: m.isBreak, tableOpen: m.tableOpen, ballInHand: m.ballInHand,
    calledPocket: m.calledPocket, winner: m.winner, winReason: m.winReason, lastFoul: m.lastFoul,
    lastMessage: m.lastMessage, shotCount: m.shotCount, groups: [m.players[0].group, m.players[1].group],
  };
}

export function encodeState(g: GameController, shot: NetShot | null): PoolNetState {
  return { v: 1, balls: encodeBalls(g), match: encodeMatch(g.match), pocket: [...g.pocketOrder], shot };
}

/** Coloca as bolas exatamente como no pacote (parada). */
export function applyBalls(g: GameController, balls: NetBall[]): void {
  for (const nb of balls) {
    const b = g.world.balls.find((o) => o.id === nb.id);
    if (!b) continue;
    b.x = b.px = nb.x; b.y = b.py = nb.y;
    b.vx = b.vy = b.wx = b.wy = b.wz = 0;
    b.pocketed = nb.p === 1; b.pocketId = nb.pk >= 0 ? nb.pk : null;
    const n = Math.hypot(...nb.q) || 1;
    b.q = [nb.q[0] / n, nb.q[1] / n, nb.q[2] / n, nb.q[3] / n];
  }
  g.world.events = [];
}

export function applyMatch(g: GameController, nm: NetMatch, names: [string, string]): void {
  const m = g.match;
  g.match = {
    ...m,
    mode: 'local',
    players: [
      { name: names[0], isAI: false, group: nm.groups[0] },
      { name: names[1], isAI: false, group: nm.groups[1] },
    ],
    current: nm.current, breaker: nm.breaker, isBreak: nm.isBreak, tableOpen: nm.tableOpen, ballInHand: nm.ballInHand,
    calledPocket: nm.calledPocket, winner: nm.winner, winReason: nm.winReason, lastFoul: nm.lastFoul,
    lastMessage: nm.lastMessage, shotCount: nm.shotCount,
  };
}

/** Estado completo (fim de tacada): bolas, regras, canaleta. */
export function applyState(g: GameController, s: PoolNetState, names: [string, string]): void {
  applyBalls(g, s.balls);
  applyMatch(g, s.match, names);
  g.pocketOrder = [...s.pocket];
  g.phase = s.match.winner !== null ? 'over' : 'aiming';
}

// ------------------------------------------------------------ validação do que chega da rede
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isTurn = (v: unknown): v is 0 | 1 => v === 0 || v === 1;
const isGroup = (v: unknown) => v === null || v === 'solids' || v === 'stripes';
const isStr = (v: unknown, max = 400) => typeof v === 'string' && v.length <= max;

function validBalls(v: unknown): v is NetBall[] {
  if (!Array.isArray(v) || v.length !== 16) return false;
  const seen = new Set<number>();
  for (const b of v as NetBall[]) {
    if (!b || !Number.isInteger(b.id) || b.id < 0 || b.id > 15 || seen.has(b.id)) return false;
    seen.add(b.id);
    if (!isNum(b.x) || !isNum(b.y) || Math.abs(b.x) > 10 || Math.abs(b.y) > 10) return false;
    if (b.p !== 0 && b.p !== 1) return false;
    if (!Number.isInteger(b.pk) || b.pk < -1 || b.pk > 5) return false;
    if (!Array.isArray(b.q) || b.q.length !== 4 || !b.q.every(isNum)) return false;
  }
  return true;
}

/** Recusa pacote malformado antes de tocar no jogo. Devolve null se inválido. */
export function parsePoolState(v: unknown): PoolNetState | null {
  const s = v as PoolNetState;
  if (!s || typeof s !== 'object' || s.v !== 1 || !validBalls(s.balls)) return null;
  const m = s.match;
  if (!m || !isTurn(m.current) || !isTurn(m.breaker) || typeof m.isBreak !== 'boolean' || typeof m.tableOpen !== 'boolean' ||
      !['none', 'kitchen', 'anywhere'].includes(m.ballInHand) ||
      !(m.calledPocket === null || (Number.isInteger(m.calledPocket) && m.calledPocket >= 0 && m.calledPocket <= 5)) ||
      !(m.winner === null || isTurn(m.winner)) || !isStr(m.winReason) || !(m.lastFoul === null || isStr(m.lastFoul)) ||
      !isStr(m.lastMessage) || !Number.isInteger(m.shotCount) || m.shotCount < 0 ||
      !Array.isArray(m.groups) || m.groups.length !== 2 || !m.groups.every(isGroup)) return null;
  if (!Array.isArray(s.pocket) || s.pocket.length > 16 || !s.pocket.every((n) => Number.isInteger(n) && n >= 1 && n <= 15)) return null;
  if (s.shot !== null) {
    if (!s.shot || !validBalls(s.shot.from) || !Array.isArray(s.shot.cue) || s.shot.cue.length !== 5 || !s.shot.cue.every(isNum)) return null;
    if (Math.hypot(s.shot.cue[0], s.shot.cue[1]) > 20) return null;
  }
  return s;
}
