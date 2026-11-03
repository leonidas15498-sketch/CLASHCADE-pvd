import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeRoute } from '../../src/app/route';
import { GAMES, gameByRoute } from '../../src/games/registry';
import { mountSafely, onMountRollback } from '../../src/games/shared/lifecycle';
import { Shell } from '../../src/games/shared/shell';
import { createStore } from '../../src/services/storage';
import { walletStore, recoverWallet } from '../../src/services/economy';
import { recoverTournament, drawOrder } from '../../src/services/tournament';
import { loadPrefs, loadStats, savePrefs, saveStats } from '../../src/games/pool/storage/storage';
import sw from '../../public/sw.js?raw';
import { Sfx } from '../../src/games/shared/sfx';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('V12 navigation', () => {
  it('accepts all ten routes and decodes escapes without throwing on invalid or unknown hashes', () => {
    expect(GAMES).toHaveLength(10);
    for (const g of GAMES) expect(gameByRoute(decodeRoute('#' + g.route))).toBe(g);
    expect(decodeRoute('#%70ong')).toBe('pong');
    for (const h of ['#%', '#%E0%A4', '#%ZZ']) expect(decodeRoute(h)).toBe('');
    expect(gameByRoute(decodeRoute('#unknown'))).toBeUndefined();
  });
});
describe('V12 persistence', () => {
  it('recovers wallet fields independently, preserving balance, inventory and ledger', () => {
    const raw = { balance: 210, owned: ['pool.cue.ebano'], ledger: ['match:old'], day: { matchCoins: -4, matches: 'bad', aiWins: null }, maxDay: '2026-11-02' };
    const w = recoverWallet(raw);
    expect(w.balance).toBe(210); expect(w.owned).toEqual(raw.owned); expect(w.ledger).toEqual(raw.ledger);
    expect(w.day).toMatchObject({ matchCoins: 0, matches: 0, aiWins: 0 });
    expect(w.maxDay).toBe('2026-11-02');
    expect(recoverWallet({ balance: 1e100, maxDay: '2026-02-31' })).toMatchObject({ balance: 0, maxDay: '' });
  });
  it('does not rewrite corrupted or partial saves just by loading', () => {
    mem.set('jogaco.wallet.v1', '{'); expect(walletStore.load().balance).toBe(0);
    expect(mem.get('jogaco.wallet.v1')).toBe('{');
    mem.set('jogaco.wallet.v1', JSON.stringify({ v: 1, data: { balance: 90 } }));
    expect(walletStore.load().balance).toBe(90);
  });
  it('survives failed reads, writes and reset', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('denied'); } });
    const store = createStore('x', 1, () => 1, (x): x is number => typeof x === 'number');
    expect(store.load()).toBe(1); expect(() => store.save(2)).not.toThrow(); expect(() => store.reset()).not.toThrow();
    expect(() => savePrefs(loadPrefs())).not.toThrow(); expect(() => saveStats(loadStats())).not.toThrow();
  });
  it('keeps unsaved progress in memory on quota errors without sharing mutable snapshots', () => {
    const store = createStore('transient', 1, () => ({ score: 0 }), (x): x is { score: number } => !!x && typeof (x as { score: number }).score === 'number');
    store.save({ score: 10 });
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } });
    expect(store.load().score).toBe(10);
    store.save({ score: 20 });
    const loaded = store.load(); loaded.score = 999;
    expect(store.load().score).toBe(20);
  });
  it('preserves valid pool preferences and nested statistics, repairing only bad fields', () => {
    mem.set('sinuca8.prefs.v1', JSON.stringify({ names: null, power: 5, cue: 'neon', table: 'galaxia', difficulty: 'hard', shotTime: 0, musicVolume: -1 }));
    expect(loadPrefs()).toMatchObject({ cue: 'neon', table: 'galaxia', difficulty: 'hard', shotTime: 0, power: 0.35, musicVolume: 0.4, names: ['Jogador 1', 'Jogador 2'] });
    mem.set('sinuca8.stats.v1', JSON.stringify({ ai: { hard: { w: 11, l: -1 } }, local: [null, { at: 'today', p1: 'A', p2: 'B', winner: 'A' }] }));
    expect(loadStats().ai.hard).toEqual({ w: 11, l: 0 }); expect(loadStats().local).toHaveLength(1);
  });
  it('recovers tournament results and rejects an empty draw', () => {
    const t = recoverTournament({ active: true, order: ['pong'], names: ['Ana', 9], wins: [999, -1], idx: -4, results: [{ route: 'pong', winner: 0 }, null], ids: ['id'] });
    expect(t.wins).toEqual([1, 0]); expect(t.names).toEqual(['Ana', '']); expect(t.idx).toBe(0); expect(t.ids).toEqual(['id']);
    expect(() => drawOrder([])).toThrow();
  });
});
describe('V12 mount rollback', () => {
  it('handles an audio resume rejected by concurrent context shutdown', async () => {
    const sfx = new Sfx();
    const resume = vi.fn().mockRejectedValue(new Error('closed during resume'));
    (sfx as unknown as { ctx: unknown }).ctx = { state: 'suspended', resume, close: () => Promise.resolve() };
    sfx.unlock(); sfx.dispose();
    await Promise.resolve(); await Promise.resolve();
    expect(resume).toHaveBeenCalledOnce();
  });
  it('releases every owner on failure, even if one cleanup throws, and preserves original error', () => {
    const actions: string[] = [];
    expect(() => mountSafely(() => {
      onMountRollback(() => actions.push('first'));
      onMountRollback(() => { actions.push('second'); throw Error('cleanup'); });
      throw Error('mount failed');
    })).toThrow('mount failed');
    expect(actions).toEqual(['second', 'first']);
  });
  it('does not release successful mounts prematurely or retain their rollback', () => {
    const cleanup = vi.fn(); const instance = { destroy: cleanup };
    expect(mountSafely(() => { onMountRollback(cleanup); return instance; })).toBe(instance);
    expect(() => mountSafely(() => { throw Error('later'); })).toThrow(); expect(cleanup).not.toHaveBeenCalled();
    instance.destroy(); expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
describe('V12 confirmation suspension', () => {
  it.each([false, true])('restores previous pause=%s and notifies the simulation only when needed', wasPaused => {
    vi.stubGlobal('document', { hidden: false });
    const buttons = new Map<string, { onclick: (() => void) | null; textContent: string }>();
    for (const key of ['c-msg','c-yes','c-no']) buttons.set(key, { onclick: null, textContent: '' });
    const onPause = vi.fn();
    const fake = { paused: wasPaused, inMatch: true, o: { onPause }, k: (k: string) => buttons.get(k)!, show: vi.fn(), hide: vi.fn() };
    Shell.prototype.confirm.call(fake as unknown as Shell, 'Exit?', vi.fn());
    expect(fake.paused).toBe(true);
    buttons.get('c-no')!.onclick!();
    expect(fake.paused).toBe(wasPaused);
    expect(onPause.mock.calls).toEqual(wasPaused ? [] : [[true], [false]]);
  });
});
describe('V12 service worker cache ownership', () => {
  it('removes only old Clashcade caches', async () => {
    const handlers = new Map<string, (e: { waitUntil(p: Promise<unknown>): void }) => void>();
    const removed: string[] = [];
    const self = { addEventListener: (name: string, cb: (e: { waitUntil(p: Promise<unknown>): void }) => void) => handlers.set(name, cb), clients: { claim: async () => {} } };
    const caches = { keys: async () => ['clashcade-v1','clashcade-v12','clashcade-v13','other-app-v1'], delete: async (k: string) => { removed.push(k); return true; } };
    new Function('self','caches',sw)(self,caches);
    let done: Promise<unknown> = Promise.resolve();
    handlers.get('activate')!({ waitUntil: p => { done = p; } }); await done;
    expect(removed).toEqual(['clashcade-v1','clashcade-v12']);
  });
});
