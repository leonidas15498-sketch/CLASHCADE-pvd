export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'closed';
export interface OnlineIdentity { id: string; }
export interface Connect4Room {
  id: string; code: string; host_id: string; guest_id: string | null;
  host_name: string; guest_name: string | null; host_seen: string; guest_seen: string | null;
  host_ready: boolean; guest_ready: boolean;
  status: 'waiting' | 'playing' | 'finished' | 'closed';
  board: number[]; turn: 0 | 1; first_player: 0 | 1; winner: '0' | '1' | 'draw' | null;
  scores: [number, number]; rematch: [boolean, boolean]; round: number; version: number; moves: number;
}
export interface RoomEvents {
  state(room: Connect4Room): void;
  connection(state: ConnectionState): void;
  error(message: string): void;
}
export interface Connect4Rooms {
  identity(): Promise<OnlineIdentity>;
  create(name: string): Promise<Connect4Room>;
  join(code: string, name: string): Promise<Connect4Room>;
  resume(roomId: string): Promise<Connect4Room>;
  watch(room: Connect4Room, events: RoomEvents): Promise<void>;
  move(room: Connect4Room, column: number, commandId?: string): Promise<Connect4Room>;
  rematch(room: Connect4Room): Promise<Connect4Room>;
  leave(room: Connect4Room): Promise<void>;
  dispose(): void;
}

/** Reject malformed network state before it reaches the existing canvas renderer. */
export function parseRoom(value: unknown): Connect4Room {
  const r = value as Connect4Room;
  if (!r || typeof r.id !== 'string' || typeof r.code !== 'string' ||
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
      !Number.isSafeInteger(r.moves) || r.moves < 0 || r.moves > 42 ||
      !Number.isFinite(Date.parse(r.host_seen)) || (r.guest_seen !== null && !Number.isFinite(Date.parse(r.guest_seen)))) {
    throw new Error('Invalid room state');
  }
  return r;
}
