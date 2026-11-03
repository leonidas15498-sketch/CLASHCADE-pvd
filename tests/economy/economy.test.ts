import { beforeEach, describe, expect, it } from 'vitest';

// localStorage mínimo (os testes rodam em Node, sem navegador)
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;
import { CATALOG, itemByKey } from '../../src/services/catalog';
import { buy, challengesToday, claimDaily, DAILY_BONUS, getWallet, isUnlocked, MATCH_DAILY_CAP, rewardMatch, walletStore } from '../../src/services/economy';
import { getSession, newSession, recordLocalResult } from '../../src/services/session';
import { reportMatch } from '../../src/services/match';
import { _dicts, _games } from '../../src/i18n';
import { CUES } from '../../src/games/pool/game/cues';
import { TABLE_THEMES } from '../../src/games/pool/game/tables';
import { PUTTERS } from '../../src/games/minigolf/render/putters';
import { COURSE_THEMES } from '../../src/games/minigolf/render/courses';
import { TRAILS } from '../../src/games/shared/fx';
import { PREMIUM_UNLOCKED_FOR_TESTING } from '../../src/games/shared/flags';
import { GAMES } from '../../src/games/registry';

beforeEach(() => localStorage.clear());
const setBalance = (n: number) => {
  const w = walletStore.load();
  w.balance = n;
  walletStore.save(w);
};

describe('catálogo', () => {
  it('todo cosmético dos jogos existe no catálogo, premium continua premium, e há exatamente 1 padrão por categoria', () => {
    const keys = [
      ...CUES.map((c) => `pool.cue.${c.id}`),
      ...TABLE_THEMES.map((t) => `pool.table.${t.id}`),
      ...PUTTERS.map((p) => `golf.putter.${p.id}`),
      'golf.putter.custom',
      ...COURSE_THEMES.map((c) => `golf.course.${c.id}`),
      ...TRAILS.map((t) => `fx.trail.${t.id}`),
    ];
    for (const k of keys) expect(itemByKey(k), k).toBeTruthy();
    for (const c of CUES) if (c.tier === 'premium') expect(itemByKey(`pool.cue.${c.id}`)!.tier).toBe('premium');
    const defaults = new Map<string, number>();
    for (const it of CATALOG) if (it.tier === 'default') defaults.set(`${it.game}.${it.kind}`, (defaults.get(`${it.game}.${it.kind}`) ?? 0) + 1);
    expect(defaults.get('sinuca.taco')).toBe(1);
    expect(defaults.get('sinuca.mesa')).toBe(1);
    expect(defaults.get('minigolfe.taco')).toBe(1);
    expect(defaults.get('minigolfe.campo')).toBe(1);
    expect(CATALOG.filter((x) => x.tier === 'coins').every((x) => x.price > 0)).toBe(true);
  });
  it('Halloween tem versão por fichas e versão premium', () => {
    const h = CATALOG.filter((x) => x.seasonal === 'halloween');
    expect(h.some((x) => x.tier === 'coins')).toBe(true);
    expect(h.some((x) => x.tier === 'premium')).toBe(true);
  });
});

describe('fichas', () => {
  it('bônus diário só uma vez por dia; relógio para trás não libera de novo', () => {
    expect(claimDaily('2026-11-01')).toBe(DAILY_BONUS);
    expect(claimDaily('2026-11-01')).toBe(0);
    expect(claimDaily('2026-10-31')).toBe(0);
    expect(claimDaily('2026-11-02')).toBe(DAILY_BONUS);
    expect(getWallet().balance).toBe(2 * DAILY_BONUS);
  });
  it('recompensa por partida é idempotente e tem teto diário', () => {
    const e = { matchId: 'm1', game: 'pong', mode: 'local' as const, winner: 0 as const };
    const a = rewardMatch(e, '2026-11-01');
    expect(a).toBeGreaterThan(0);
    expect(rewardMatch(e, '2026-11-01')).toBe(0);
    for (let i = 0; i < 40; i++) rewardMatch({ ...e, matchId: `x${i}` }, '2026-11-01');
    expect(getWallet().day.matchCoins).toBe(MATCH_DAILY_CAP);
  });
  it('desafios: 2 partidas, 2 jogos, vencer IA médio — cada um pago uma vez', () => {
    rewardMatch({ matchId: 'a', game: 'pong', mode: 'solo', winner: null }, '2026-11-01');
    rewardMatch({ matchId: 'b', game: 'pong', mode: 'ai', winner: 0, difficulty: 'easy' }, '2026-11-01');
    let w = getWallet();
    expect(w.day.done).toEqual(['two-matches']);
    rewardMatch({ matchId: 'c', game: 'lig-4', mode: 'ai', winner: 0, difficulty: 'medium' }, '2026-11-01');
    w = getWallet();
    expect(w.day.done.sort()).toEqual(['beat-ai', 'two-games', 'two-matches']);
    expect(w.balance).toBe(3 * 5 + 20 + 25 + 35);
    rewardMatch({ matchId: 'd', game: 'blocos', mode: 'ai', winner: 0, difficulty: 'hard' }, '2026-11-01');
    expect(getWallet().balance).toBe(4 * 5 + 20 + 25 + 35);
    expect(challengesToday('2026-11-01').every((c) => c.done)).toBe(true);
    // dia seguinte: desafios zerados
    expect(challengesToday('2026-11-02').some((c) => c.done)).toBe(false);
  });
  it('perder para a IA não completa "vencer a IA"', () => {
    rewardMatch({ matchId: 'l', game: 'pong', mode: 'ai', winner: 1, difficulty: 'hard' }, '2026-11-01');
    expect(getWallet().day.aiWins).toBe(0);
  });
});

describe('inventário e compra', () => {
  it('só o padrão vem liberado; item por fichas exige compra', () => {
    expect(isUnlocked('pool.cue.classico')).toBe(true);
    expect(isUnlocked('pool.cue.ebano')).toBe(false);
    expect(isUnlocked('golf.putter.custom')).toBe(false);
    expect(isUnlocked('nao.existe')).toBe(false);
    expect(isUnlocked('pool.cue.dragao')).toBe(PREMIUM_UNLOCKED_FOR_TESTING);
  });
  it('compra atômica: sem saldo não debita; com saldo debita uma vez; repetir não cobra', () => {
    setBalance(130);
    expect(buy('pool.cue.oceano')).toBe('funds'); // 150
    expect(getWallet().balance).toBe(130);
    expect(buy('pool.cue.ebano')).toBe('ok'); // 120
    expect(getWallet().balance).toBe(10);
    expect(isUnlocked('pool.cue.ebano')).toBe(true);
    setBalance(500);
    expect(buy('pool.cue.ebano')).toBe('owned');
    expect(getWallet().balance).toBe(500);
  });
  it('fichas não compram premium nem padrão', () => {
    setBalance(10000);
    expect(buy('pool.cue.dragao')).toBe('premium');
    expect(buy('pool.cue.classico')).toBe('owned');
    expect(getWallet().balance).toBe(10000);
  });
});

describe('placar de sessão', () => {
  it('só vitória 2P local conta, uma vez; empate, IA e solo não', () => {
    expect(recordLocalResult('m1', 'local', 0)).toBe(true);
    expect(recordLocalResult('m1', 'local', 0)).toBe(false);
    expect(recordLocalResult('m2', 'ai', 0)).toBe(false);
    expect(recordLocalResult('m3', 'local', 'draw')).toBe(false);
    expect(recordLocalResult('m4', 'solo', null)).toBe(false);
    expect(recordLocalResult('m5', 'local', 1)).toBe(true);
    expect(getSession()).toMatchObject({ red: 1, blue: 1 });
  });
  it('reportMatch repetido não dá vitória nem fichas em dobro; nova sessão não mexe nas fichas', () => {
    const e = { matchId: 'z', game: 'pong', mode: 'local' as const, winner: 1 as const };
    reportMatch(e);
    reportMatch(e);
    expect(getSession().blue).toBe(1);
    const bal = getWallet().balance;
    expect(bal).toBe(5);
    newSession();
    expect(getSession().blue).toBe(0);
    expect(getWallet().balance).toBe(bal);
  });
});

describe('idiomas', () => {
  it('en-US e es-ES têm todas as chaves do pt-BR e todos os jogos do catálogo', () => {
    const base = Object.keys(_dicts['pt-BR']);
    for (const l of ['en-US', 'es-ES'] as const) {
      for (const k of base) expect(_dicts[l][k], `${l}:${k}`).toBeTruthy();
      for (const g of GAMES) expect(_games[l][g.id], `${l}:${g.id}`).toBeTruthy();
    }
    for (const g of GAMES) expect(_games['pt-BR'][g.id]).toBeTruthy();
  });
});
