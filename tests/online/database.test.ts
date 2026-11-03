import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import migration from '../../supabase/migrations/20261102205003_clashcade_connect4_online.sql?raw';
import { Connect4Room } from '../../src/services/online/types';

// Real local PostgreSQL/WASM. Supabase Auth itself is not emulated as a service:
// only auth.uid() is provided from test session settings for SQL/RLS validation.
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
let db: PGlite;
async function actor(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function command(id: string, action: string, room?: Connect4Room, extra: { code?: string; name?: string; column?: number; version?: number; round?: number; commandId?: string } = {}) {
  await actor(id);
  const out = await db.query<{ room: Connect4Room }>('select public.clashcade_command($1,$2,$3,$4,$5,$6,$7,$8) as room',
    [action, extra.commandId ?? crypto.randomUUID(), room?.id ?? null, extra.code ?? null, extra.name ?? 'Player', extra.column ?? null, extra.version ?? room?.version ?? null, extra.round ?? room?.round ?? null]);
  return out.rows[0].room;
}
async function pair() {
  const host = await command(ids[0], 'create');
  const joined = await command(ids[1], 'join', undefined, { code: host.code });
  await command(ids[0], 'ready', joined);
  return command(ids[1], 'ready', joined);
}
async function sequence(columns: number[]) {
  let room = await pair();
  for (const column of columns) room = await command(ids[room.turn], 'move', room, { column });
  return room;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    insert into auth.users values ${ids.map(id => `('${id}')`).join(',')};`);
  await db.exec(migration);
}, 60000);
beforeEach(async () => { await db.exec('reset role; truncate public.clashcade_rooms,clashcade_private.commands;'); });
afterAll(async () => { await db?.close(); });

describe('authoritative Connect4 SQL on local PostgreSQL', () => {
  it('creates, joins, starts and reconnects with stable player identity', async () => {
    const host = await command(ids[0], 'create'); expect(host.status).toBe('waiting'); expect(host.code).toMatch(/^[A-F0-9]{10}$/);
    let room = await command(ids[1], 'join', undefined, { code: host.code });
    expect(room.status).toBe('waiting');
    await command(ids[0], 'ready', room);
    room = await command(ids[1], 'ready', room);
    expect(room.status).toBe('playing'); expect(room.host_id).toBe(ids[0]); expect(room.guest_id).toBe(ids[1]);
    const resumed = await command(ids[0], 'resume', room); expect(resumed.id).toBe(room.id); expect(resumed.board).toEqual(room.board);
  });
  it('rejects a third participant and unauthorized room access', async () => {
    const room = await pair();
    await expect(command(ids[2], 'join', undefined, { code: room.code })).rejects.toThrow('ROOM_FULL');
    await expect(command(ids[2], 'resume', room)).rejects.toThrow('NOT_PARTICIPANT');
    await actor(ids[2]); expect((await db.query('select * from public.clashcade_rooms')).rows).toHaveLength(0);
  });
  it('enforces turn, column, version and deduplicates an accepted command', async () => {
    let room = await pair();
    await expect(command(ids[1], 'move', room, { column: 0 })).rejects.toThrow('NOT_YOUR_TURN');
    await expect(command(ids[0], 'move', room, { column: 7 })).rejects.toThrow('INVALID_COLUMN');
    const initial = room, commandId = crypto.randomUUID();
    room = await command(ids[0], 'move', initial, { column: 0, commandId }); expect(room.turn).toBe(1);
    expect((await command(ids[0], 'move', initial, { column: 0, commandId })).moves).toBe(1);
    await expect(command(ids[0], 'move', initial, { column: 1, commandId })).rejects.toThrow('COMMAND_REUSED');
    await expect(command(ids[1], 'move', initial, { column: 1 })).rejects.toThrow('STALE_VERSION');
  });
  it('rejects full columns', async () => {
    const room = await sequence([0,0,0,0,0,0]);
    await expect(command(ids[room.turn], 'move', room, { column: 0 })).rejects.toThrow('COLUMN_FULL');
  });
  it('computes victory and score itself, then requires both rematch consents', async () => {
    let room = await sequence([0,1,0,1,0,1,0]);
    expect(room.winner).toBe('0'); expect(room.scores).toEqual([1,0]); expect(room.status).toBe('finished');
    await expect(command(ids[0], 'move', room, { column: 4 })).rejects.toThrow('NOT_PLAYING');
    room = await command(ids[0], 'rematch', room); expect(room.status).toBe('finished');
    room = await command(ids[1], 'rematch', room); expect(room.status).toBe('playing'); expect(room.round).toBe(2);
    expect(room.turn).toBe(1); expect(room.scores).toEqual([1,0]); expect(room.board.every(n => n === 0)).toBe(true);
  });
  it('computes a full-board draw without awarding a win', async () => {
    const room = await sequence([0,1,0,1,0,1,1,0,1,0,1,0,2,3,2,3,2,3,3,2,3,2,3,2,4,5,4,5,4,5,5,4,5,4,5,4,6,6,6,6,6,6]);
    expect(room.winner).toBe('draw'); expect(room.moves).toBe(42); expect(room.scores).toEqual([0,0]);
  });
  it('blocks direct state and score writes, and closes a room on leave', async () => {
    const room = await pair(); await actor(ids[0]);
    await expect(db.query("update public.clashcade_rooms set winner='0',scores=array[99,0] where id=$1",[room.id])).rejects.toThrow(/permission denied/);
    await expect(db.exec('select * from clashcade_private.commands')).rejects.toThrow(/permission denied/);
    expect((await command(ids[0], 'leave', room)).status).toBe('closed');
    await expect(command(ids[1], 'move', room, { column: 0 })).rejects.toThrow('ROOM_CLOSED');
  });
  it('suspends moves after disconnect and accepts heartbeat-based reconnection', async () => {
    let room = await pair();
    await db.exec('reset role'); await db.query("update public.clashcade_rooms set guest_seen=now()-interval '1 minute' where id=$1",[room.id]);
    await expect(command(ids[0], 'move', room, { column: 0 })).rejects.toThrow('PLAYER_DISCONNECTED');
    room = await command(ids[1], 'resume', room); room = await command(ids[0], 'move', room, { column: 0 }); expect(room.moves).toBe(1);
  });
  it('rejects an unauthenticated caller even through the privileged operation', async () => {
    await actor('');
    await expect(db.query("select public.clashcade_command('create',$1)",[crypto.randomUUID()])).rejects.toThrow('AUTH_REQUIRED');
  });
  it.each([
    [0,0,1,1,2,2,3],
    [0,1,1,2,2,3,2,3,3,6,3],
    [6,5,5,4,4,3,4,3,3,0,3],
  ])('computes horizontal and diagonal lines on the server: %j', async (...columns: number[]) => {
    const room = await sequence(columns); expect(room.winner).toBe('0'); expect(room.scores).toEqual([1,0]);
  });
  it('rejects a second queued command for the same state instead of applying both', async () => {
    const room = await pair(); await actor(ids[0]);
    const sql = "select public.clashcade_command('move',$1,$2,null,null,$3,$4,$5) as room";
    const pending = [0,1].map(column => db.query(sql,[crypto.randomUUID(),room.id,column,room.version,room.round]));
    const results = await Promise.allSettled(pending);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect((await command(ids[0], 'resume', room)).moves).toBe(1);
    // PGlite queues a single connection: a multi-connection lock-contention test
    // against hosted PostgreSQL is still required, not claimed by this test.
  });
});
