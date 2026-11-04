import { beforeEach, describe, expect, it } from 'vitest';
import { C4_BOARDS, CHECKERS_BOARDS, equip, equipped, HOCKEY_PUCKS, HOCKEY_TABLES, PONG_BALLS, PONG_COURTS } from '../../src/games/shared/arenaThemes';
import { CATALOG, itemByKey } from '../../src/services/catalog';
import { buy, walletStore } from '../../src/services/economy';

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

const LISTS = { 'air-hockey': [...HOCKEY_TABLES, ...HOCKEY_PUCKS], pong: [...PONG_COURTS, ...PONG_BALLS], 'lig-4': C4_BOARDS, damas: CHECKERS_BOARDS };

describe('lojas dos jogos do Shell', () => {
  beforeEach(() => localStorage.clear());
  it('cada tema existe no catálogo, no jogo certo, e o primeiro de cada lista é o padrão', () => {
    for (const [game, list] of Object.entries(LISTS)) for (const t of list) expect(itemByKey(t.key)?.game, t.key).toBe(game);
    for (const l of [HOCKEY_TABLES, HOCKEY_PUCKS, PONG_COURTS, PONG_BALLS, C4_BOARDS, CHECKERS_BOARDS]) expect(itemByKey(l[0].key)?.tier).toBe('default');
    // Todo item desses jogos no catálogo tem tema desenhável
    const keys = new Set(Object.values(LISTS).flat().map((t) => t.key));
    for (const it of CATALOG.filter((x) => x.game in LISTS)) expect(keys.has(it.key), it.key).toBe(true);
  });
  it('não equipa item bloqueado; equipa depois de comprar; salvo inválido volta ao padrão', () => {
    expect(equipped('hockey.table', HOCKEY_TABLES).key).toBe('hockey.table.classica');
    expect(equip('hockey.table', 'hockey.table.gelo')).toBe(false);
    expect(equipped('hockey.table', HOCKEY_TABLES).key).toBe('hockey.table.classica');
    const w = walletStore.load();
    w.balance = 500;
    walletStore.save(w);
    expect(buy('hockey.table.gelo')).toBe('ok');
    expect(equip('hockey.table', 'hockey.table.gelo')).toBe(true);
    expect(equipped('hockey.table', HOCKEY_TABLES).key).toBe('hockey.table.gelo');
    // chave de outro jogo no espaço errado não vale
    localStorage.setItem('clashcade.equipped.v1', JSON.stringify({ v: 1, data: { 'hockey.table': 'pong.court.gelo' } }));
    expect(equipped('hockey.table', HOCKEY_TABLES).key).toBe('hockey.table.classica');
  });
});
