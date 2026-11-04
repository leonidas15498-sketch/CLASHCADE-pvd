export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'closed';
export interface OnlineIdentity { id: string; }
/** Jogos com sala privada. Novo jogo: incluir aqui E no check da coluna `game` (nova migração). */
export type OnlineGame = 'connect4' | 'pool';
export const ONLINE_GAMES: readonly OnlineGame[] = ['connect4', 'pool'];
/** Versão do protocolo do banco (public.clashcade_online_status). 2 = salas multijogo. */
export const ONLINE_PROTOCOL = 2;

export interface Room {
  id: string; code: string; game: OnlineGame; host_id: string; guest_id: string | null;
  host_name: string; guest_name: string | null; host_seen: string; guest_seen: string | null;
  host_ready: boolean; guest_ready: boolean;
  status: 'waiting' | 'playing' | 'finished' | 'closed';
  /** Só o Quatro em Linha usa; nos outros jogos fica zerado. */
  board: number[]; turn: 0 | 1; first_player: 0 | 1; winner: '0' | '1' | 'draw' | null;
  scores: [number, number]; rematch: [boolean, boolean]; round: number; version: number; moves: number;
  /** Estado do jogo enviado por quem jogou (jogos com física). null = partida nova. Validar antes de usar. */
  state: Record<string, unknown> | null;
  turn_started: string;
}
/** Compatibilidade: o Quatro em Linha usa o mesmo formato de sala. */
export type Connect4Room = Room;

/** Jogada de jogo com física: o servidor confere vez/versão/forma e grava `state`. */
export interface StatePayload {
  kind: 'shot' | 'timeout';
  next_turn: 0 | 1;
  winner: '0' | '1' | null;
  state: Record<string, unknown>;
}

export interface RoomEvents {
  state(room: Room): void;
  connection(state: ConnectionState): void;
  error(message: string): void;
  /** Mensagem efêmera do outro aparelho (ex.: mira ao vivo). Não passa pelo banco; pode chegar fora de ordem ou se perder. */
  live?(data: Record<string, unknown>): void;
}
export interface Rooms {
  readonly game: OnlineGame;
  identity(): Promise<OnlineIdentity>;
  create(name: string): Promise<Room>;
  join(code: string, name: string): Promise<Room>;
  resume(roomId: string): Promise<Room>;
  watch(room: Room, events: RoomEvents): Promise<void>;
  move(room: Room, column: number, commandId?: string): Promise<Room>;
  submit(room: Room, payload: StatePayload): Promise<Room>;
  rematch(room: Room): Promise<Room>;
  leave(room: Room): Promise<void>;
  /** Envia mensagem efêmera ao outro aparelho (Realtime broadcast). Opcional: sem suporte, simplesmente não envia. */
  sendLive?(room: Room, data: Record<string, unknown>): void;
  dispose(): void;
}
export type Connect4Rooms = Rooms;

/** Reject malformed network state before it reaches the existing canvas renderer. */
export function parseRoom(value: unknown): Room {
  const r = value as Room;
  if (!r || typeof r.id !== 'string' || typeof r.code !== 'string' || !ONLINE_GAMES.includes(r.game) ||
      typeof r.host_id !== 'string' || (r.guest_id !== null && typeof r.guest_id !== 'string') ||
      typeof r.host_name !== 'string' || (r.guest_name !== null && typeof r.guest_name !== 'string') ||
      typeof r.host_ready !== 'boolean' || typeof r.guest_ready !== 'boolean' ||
      !['waiting','playing','finished','closed'].includes(r.status) ||
      !Array.isArray(r.board) || r.board.length !== 42 || !r.board.every(n => n === 0 || n === 1 || n === 2) ||
      ![0,1].includes(r.turn) || ![0,1].includes(r.first_player) ||
      ![null,'0','1','draw'].includes(r.winner) ||
      !Array.isArray(r.scores) || r.scores.length !== 2 || !r.scores.every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Array.isArray(r.rematch) || r.rematch.length !== 2 || !r.rematch.every(v => typeof v === 'boolean') ||
      !Number.isSafeInteger(r.version) || r.version < 0 || !Number.isSafeInteger(r.round) || r.round < 1 ||
      !Number.isSafeInteger(r.moves) || r.moves < 0 || (r.game === 'connect4' && r.moves > 42) ||
      (r.state !== null && (typeof r.state !== 'object' || Array.isArray(r.state))) ||
      !Number.isFinite(Date.parse(r.turn_started)) ||
      !Number.isFinite(Date.parse(r.host_seen)) || (r.guest_seen !== null && !Number.isFinite(Date.parse(r.guest_seen)))) {
    throw new Error('Invalid room state');
  }
  return r;
}
