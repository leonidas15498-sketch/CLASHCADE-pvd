import { record, count, strings, text } from './validation';
/**
 * Modo Torneio (01/11): melhor de 7 entre jogos sorteados, VERMELHO (J1) × AZUL (J2), no mesmo aparelho.
 * - Vence quem chegar a 4 vitórias. Empate num jogo: o mesmo jogo é repetido (não conta).
 * - Só jogos de partida curta com 2P local e Shell (TOURNAMENT_GAMES). Sinuca, Minigolfe e Blocos ficam de fora
 *   por durarem vários minutos cada (decisão registrada no STATUS; reversível aqui).
 * - Ordem sorteada sem repetir até esgotar a lista (Fisher-Yates); cada resultado conta uma vez (matchId).
 * - Tudo local (storage com validação). Partida abandonada não conta: o torneio fica esperando o mesmo jogo.
 */
import { createStore } from './storage';

/** Rotas (registry) elegíveis. Ordem aqui não importa: o torneio sorteia. */
export const TOURNAMENT_GAMES = ['air-hockey', 'duelo-rastros', 'empilha', 'lig-4', 'pong', 'sumo-neon', 'cabo-de-guerra'] as const;
export const TOURNAMENT_WINS = 4;
export const TOURNAMENT_MAX = 7;

export interface TournamentGame {
  route: string;
  /** null = ainda não jogado; 'draw' = empatou e foi repetido. */
  winner: 0 | 1 | null;
}
export interface Tournament {
  active: boolean;
  names: [string, string];
  /** Sequência sorteada (7 rotas). */
  order: string[];
  /** Índice do jogo atual em `order`. */
  idx: number;
  wins: [number, number];
  results: TournamentGame[];
  ids: string[];
  champion: 0 | 1 | null;
  startedAt: string;
}

const def = (): Tournament => ({ active: false, names: ['', ''], order: [], idx: 0, wins: [0, 0], results: [], ids: [], champion: null, startedAt: '' });
const valid = (x: unknown): x is Tournament => {
  const t = x as Tournament;
  return (
    !!t &&
    typeof t.active === 'boolean' &&
    Array.isArray(t.order) &&
    t.order.every((r) => typeof r === 'string') &&
    Number.isInteger(t.idx) &&
    Array.isArray(t.wins) &&
    t.wins.length === 2 &&
    Array.isArray(t.results) &&
    Array.isArray(t.ids) &&
    Array.isArray(t.names)
  );
};
export function recoverTournament(x: unknown): Tournament {
  const t = record(x);
  const order = strings(t.order).filter(r => (TOURNAMENT_GAMES as readonly string[]).includes(r)).slice(0, TOURNAMENT_MAX);
  const results = Array.isArray(t.results) ? t.results.flatMap(v => {
    const r = record(v);
    return typeof r.route === 'string' && (TOURNAMENT_GAMES as readonly string[]).includes(r.route) && (r.winner === 0 || r.winner === 1)
      ? [{ route: r.route, winner: r.winner as 0 | 1 }] : [];
  }).slice(0, TOURNAMENT_MAX) : [];
  const wins: [number, number] = [0, 0];
  for (const r of results) wins[r.winner]++;
  const champion = wins[0] >= TOURNAMENT_WINS ? 0 : wins[1] >= TOURNAMENT_WINS ? 1 : null;
  return { active: t.active === true && order.length > 0, order,
    names: [text(Array.isArray(t.names) ? t.names[0] : ''), text(Array.isArray(t.names) ? t.names[1] : '')],
    idx: Math.min(count(t.idx), Math.max(0, order.length - 1)), wins, results,
    ids: strings(t.ids), champion, startedAt: text(t.startedAt) };
}
export const tournamentStore = createStore<Tournament>('clashcade.tournament.v1', 1, def, valid, recoverTournament);
export const TOURNAMENT_EVENT = 'clashcade:tournament';

const emit = () => {
  try {
    window.dispatchEvent(new CustomEvent(TOURNAMENT_EVENT));
  } catch {
    /* testes */
  }
};

/** Sorteio sem repetição (Fisher-Yates) dos jogos disponíveis. */
export function drawOrder(available: readonly string[], rng: () => number = Math.random, n = TOURNAMENT_MAX): string[] {
  if (!available.length || !Number.isSafeInteger(n) || n < 0) throw new Error('Invalid tournament draw');
  const out: string[] = [];
  while (out.length < n) {
    const pool = [...available];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // não repetir o último da rodada anterior logo em seguida
    if (out.length && pool[0] === out[out.length - 1] && pool.length > 1) [pool[0], pool[1]] = [pool[1], pool[0]];
    out.push(...pool);
  }
  return out.slice(0, n);
}

export const getTournament = () => tournamentStore.load();

export function startTournament(names: [string, string], available: readonly string[] = TOURNAMENT_GAMES, rng: () => number = Math.random): Tournament {
  const t: Tournament = { ...def(), active: true, names, order: drawOrder(available, rng), startedAt: new Date().toISOString() };
  tournamentStore.save(t);
  emit();
  return t;
}

export function endTournament() {
  tournamentStore.save(def());
  emit();
}

/** Rota do jogo da vez (ou null se não há torneio em andamento / já tem campeão). */
export function currentTournamentGame(t = getTournament()): string | null {
  if (!t.active || t.champion !== null) return null;
  return t.order[t.idx] ?? null;
}

/**
 * Registra o resultado de uma partida 2P local concluída no jogo da vez. Retorna o torneio atualizado, ou null se
 * não contou (outro jogo, repetida, sem torneio). Empate não avança: o mesmo jogo é jogado de novo.
 */
export function recordTournament(route: string, matchId: string, winner: 0 | 1 | 'draw' | null): Tournament | null {
  const t = getTournament();
  if (currentTournamentGame(t) !== route || t.ids.includes(matchId) || winner === null) return null;
  t.ids.push(matchId);
  if (winner === 'draw') {
    tournamentStore.save(t);
    emit();
    return t;
  }
  t.wins[winner]++;
  t.results.push({ route, winner });
  if (t.wins[winner] >= TOURNAMENT_WINS) t.champion = winner;
  else t.idx++;
  tournamentStore.save(t);
  emit();
  return t;
}
