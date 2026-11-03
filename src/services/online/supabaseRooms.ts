import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { T } from '../../i18n/lang';
import { ONLINE_PROTOCOL, OnlineGame, Room, RoomEvents, Rooms, StatePayload, parseRoom } from './types';

const messages: Record<string, () => string> = {
  ROOM_NOT_FOUND: () => T('Sala não encontrada.', 'Room not found.'),
  ROOM_FULL: () => T('Esta sala já tem dois jogadores.', 'This room already has two players.'),
  ROOM_CLOSED: () => T('A sala foi encerrada ou expirou.', 'The room was closed or expired.'),
  NOT_PARTICIPANT: () => T('Esta sessão não participa da sala.', 'This session is not a participant.'),
  NOT_YOUR_TURN: () => T('Aguarde sua vez.', 'Wait for your turn.'),
  STALE_VERSION: () => T('O estado mudou. Aguarde a sincronização e tente novamente.', 'The state changed. Wait for synchronization and try again.'),
  PLAYER_DISCONNECTED: () => T('Aguardando a reconexão do outro jogador.', 'Waiting for the other player to reconnect.'),
  COLUMN_FULL: () => T('Esta coluna está cheia.', 'This column is full.'),
  INVALID_COLUMN: () => T('Coluna inválida.', 'Invalid column.'),
  INVALID_CODE: () => T('Use o código de dez caracteres da sala.', 'Use the ten-character room code.'),
  INVALID_NAME: () => T('Informe um nome de até 14 caracteres.', 'Enter a name up to 14 characters.'),
  ROOM_LIMIT: () => T('Limite de salas abertas atingido. Encerre uma sala anterior.', 'Open room limit reached. Close a previous room.'),
  WRONG_GAME: () => T('Este código é de uma sala de outro jogo.', 'This code belongs to another game\'s room.'),
  TOO_EARLY: () => T('O tempo da jogada ainda não acabou.', 'The turn time is not over yet.'),
  INVALID_PAYLOAD: () => T('Jogada recusada pelo servidor. Reconecte à sala.', 'Move rejected by the server. Reconnect to the room.'),
};
function errorMessage(error: { message?: string }): string {
  const code = Object.keys(messages).find(k => error.message?.includes(k));
  return code ? messages[code]() : T('Falha na conexão online. Verifique sua rede e tente novamente.', 'Online connection failed. Check your network and try again.');
}

export class SupabaseRooms implements Rooms {
  private channel: RealtimeChannel | null = null;
  private heartbeat = 0;
  private disposed = false;
  private watchTimer = 0;
  constructor(private client: SupabaseClient, readonly game: OnlineGame) {}
  async identity() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(errorMessage(error));
    if (data.session) return { id: data.session.user.id };
    const signed = await this.client.auth.signInAnonymously();
    if (signed.error || !signed.data.user) throw new Error(T('Não foi possível iniciar a sessão anônima. Verifique a configuração de Auth.', 'Anonymous sign-in failed. Check Auth configuration.'));
    return { id: signed.data.user.id };
  }
  private async command(action: string, args: Record<string, unknown> = {}) {
    if (this.disposed) throw new Error('Connection closed');
    const { data, error } = await this.client.rpc('clashcade_command', { p_action: action, p_command_id: crypto.randomUUID(), p_game: this.game, ...args });
    if (error) throw new Error(errorMessage(error));
    return parseRoom(data);
  }
  async create(name: string) { await this.identity(); return this.command('create', { p_name: name }); }
  async join(code: string, name: string) { await this.identity(); return this.command('join', { p_code: code.trim().toUpperCase(), p_name: name }); }
  async resume(roomId: string) { await this.identity(); return this.command('resume', { p_room_id: roomId }); }
  move(room: Room, column: number, commandId = crypto.randomUUID()) {
    return this.command('move', { p_room_id: room.id, p_column: column, p_version: room.version, p_round: room.round, p_command_id: commandId });
  }
  submit(room: Room, payload: StatePayload) {
    return this.command('move', { p_room_id: room.id, p_version: room.version, p_round: room.round, p_payload: payload });
  }
  rematch(room: Room) { return this.command('rematch', { p_room_id: room.id, p_round: room.round }); }
  async leave(room: Room) { await this.command('leave', { p_room_id: room.id }); }
  async watch(room: Room, events: RoomEvents): Promise<void> {
    if (this.channel) await this.client.removeChannel(this.channel);
    clearInterval(this.heartbeat);
    events.connection('connecting');
    let realtimeConnected = false;
    let announcedReady = false;
    const refresh = async () => {
      try {
        const action = realtimeConnected && !announcedReady ? 'ready' : 'heartbeat';
        const next = await this.command(action, { p_room_id: room.id });
        if (action === 'ready') announcedReady = true;
        if (!this.disposed) { if (realtimeConnected) events.connection('connected'); events.state(next); }
      } catch (e) {
        if (!this.disposed) { events.connection('reconnecting'); events.error(e instanceof Error ? e.message : String(e)); }
      }
    };
    this.channel = this.client.channel('clashcade:' + room.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clashcade_rooms', filter: 'id=eq.' + room.id }, payload => {
        if (this.disposed) return;
        try { events.state(parseRoom(payload.new)); }
        catch { events.error(T('Estado online inválido; reconecte à sala.', 'Invalid online state; reconnect to the room.')); }
      });
    const channel = this.channel;
    await new Promise<void>((resolve, reject) => {
      const timeout = this.watchTimer = window.setTimeout(() => reject(new Error(T('Tempo de conexão esgotado.', 'Connection timed out.'))), 12000);
      channel.subscribe(status => {
        if (this.disposed) { clearTimeout(timeout); reject(new Error('Connection closed')); return; }
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
          clearTimeout(timeout); events.connection('connected'); void refresh(); resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeConnected = false;
          announcedReady = false;
          events.connection(status === 'CLOSED' ? 'disconnected' : 'reconnecting');
          events.error(T('Conexão interrompida. Tentando reconectar…', 'Connection interrupted. Reconnecting…'));
        }
      });
    });
    if (!this.disposed) this.heartbeat = window.setInterval(() => { void refresh(); }, 10000);
  }
  dispose() {
    this.disposed = true; clearInterval(this.heartbeat); clearTimeout(this.watchTimer);
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
  }
}

let clientPromise: Promise<SupabaseClient | null> | undefined;
async function configuredClient(): Promise<SupabaseClient | null> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !key.startsWith('sb_publishable_')) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' && !(['localhost','127.0.0.1'].includes(parsed.hostname) && parsed.protocol === 'http:')) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'clashcade.online.auth.v1' } });
}
/** No button is exposed on builds without configuration or a matching backend (protocol 2 = multigame). */
export async function availableRooms(game: OnlineGame = 'connect4'): Promise<Rooms | null> {
  // QA local (qa/sinuca-online.cjs): servidor de teste com a migração real em PGlite. Só em localhost.
  const testRooms = (globalThis as { __clashcadeTestRooms?: (g: OnlineGame) => Rooms }).__clashcadeTestRooms;
  if (testRooms && ['localhost', '127.0.0.1'].includes(location.hostname)) return testRooms(game);
  try {
    clientPromise ??= configuredClient();
    const client = await clientPromise;
    if (!client) return null;
    const ready = await client.rpc('clashcade_online_status').abortSignal(AbortSignal.timeout(5000));
    return !ready.error && ready.data === ONLINE_PROTOCOL ? new SupabaseRooms(client, game) : null;
  } catch { return null; }
}
