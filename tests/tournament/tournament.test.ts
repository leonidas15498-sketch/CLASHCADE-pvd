import { beforeEach, describe, expect, it } from 'vitest';
import { makeRng } from '../../src/games/pool/ai/ai';
import { GAMES } from '../../src/games/registry';
import { currentTournamentGame, drawOrder, endTournament, getTournament, recordTournament, startTournament, TOURNAMENT_GAMES } from '../../src/services/tournament';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  endTournament();
});

describe('modo torneio (melhor de 7)', () => {
  it('todos os jogos elegíveis existem no catálogo e têm 2P local', () => {
    for (const r of TOURNAMENT_GAMES) {
      const g = GAMES.find((x) => x.route === r);
      expect(g, r).toBeTruthy();
      expect(g!.modes.some((m) => m.includes('2P')), r).toBe(true);
    }
  });

  it('sorteio: 7 jogos, sem repetir enquanto houver jogo novo', () => {
    for (let i = 0; i < 50; i++) {
      const o = drawOrder(TOURNAMENT_GAMES, makeRng(i));
      expect(o).toHaveLength(7);
      expect(new Set(o).size).toBe(7);
    }
    const few = drawOrder(['a', 'b', 'c'], makeRng(3));
    expect(few).toHaveLength(7);
    for (let i = 1; i < few.length; i++) expect(few[i]).not.toBe(few[i - 1]);
  });

  it('vence quem chega a 4; resultado repetido não conta; empate repete o mesmo jogo', () => {
    const t = startTournament(['Ana', 'Beto'], TOURNAMENT_GAMES, makeRng(1));
    const g0 = t.order[0];
    expect(currentTournamentGame()).toBe(g0);
    expect(recordTournament('outro-jogo', 'x', 0)).toBeNull();
    expect(recordTournament(g0, 'm1', 'draw')).not.toBeNull();
    expect(currentTournamentGame()).toBe(g0); // empate: mesmo jogo
    recordTournament(g0, 'm2', 0);
    expect(recordTournament(g0, 'm2', 0)).toBeNull(); // repetido / já avançou
    expect(getTournament().wins).toEqual([1, 0]);
    let id = 3;
    const play = (w: 0 | 1) => recordTournament(currentTournamentGame()!, `m${id++}`, w);
    play(1);
    play(1);
    play(0);
    play(1);
    play(0);
    expect(getTournament().champion).toBe(null);
    play(0); // 4 × 3
    const end = getTournament();
    expect(end.wins).toEqual([4, 3]);
    expect(end.champion).toBe(0);
    expect(end.results).toHaveLength(7);
    expect(currentTournamentGame()).toBeNull();
  });

  it('4 × 0 encerra antes do 7º jogo', () => {
    startTournament(['', ''], TOURNAMENT_GAMES, makeRng(2));
    for (let i = 0; i < 4; i++) recordTournament(currentTournamentGame()!, `k${i}`, 1);
    expect(getTournament().champion).toBe(1);
    expect(getTournament().results).toHaveLength(4);
  });
});
