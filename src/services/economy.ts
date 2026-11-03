import { record, count, strings, date } from './validation';
/**
 * Economia local: Fichas (moeda grátis), bônus diário, recompensa por partida, desafios diários e inventário.
 * AVISO: tudo fica no aparelho (localStorage). Não é à prova de fraude e NÃO serve para nada que envolva dinheiro;
 * isso exige servidor. Regras: toda concessão tem id único (idempotente), saldo nunca negativo, compra atômica.
 * Cada mutação relê o armazenamento antes de gravar (duas abas abertas não duplicam recompensa por id).
 */
import { PREMIUM_UNLOCKED_FOR_TESTING } from '../games/shared/flags';
import { createStore } from './storage';
import { CATALOG, itemByKey } from './catalog';

export const DAILY_BONUS = 30;
export const MATCH_REWARD = 5;
export const MATCH_DAILY_CAP = 60;

export interface Challenge {
  id: 'two-matches' | 'two-games' | 'beat-ai';
  reward: number;
  goal: number;
}
export const CHALLENGES: Challenge[] = [
  { id: 'two-matches', reward: 20, goal: 2 },
  { id: 'two-games', reward: 25, goal: 2 },
  { id: 'beat-ai', reward: 35, goal: 1 },
];

export interface Wallet {
  balance: number;
  /** Ids de concessões/compras já aplicadas (os mais recentes). */
  ledger: string[];
  owned: string[];
  /** Último dia (AAAA-MM-DD local) em que o bônus diário foi pego. */
  lastDaily: string;
  /** Maior dia já visto (relógio voltado para trás não libera bônus de novo). */
  maxDay: string;
  day: { date: string; matchCoins: number; matches: number; games: string[]; aiWins: number; done: string[] };
}

const emptyDay = (date: string) => ({ date, matchCoins: 0, matches: 0, games: [] as string[], aiWins: 0, done: [] as string[] });
const def = (): Wallet => ({ balance: 0, ledger: [], owned: [], lastDaily: '', maxDay: '', day: emptyDay('') });
const isStrArr = (x: unknown) => Array.isArray(x) && x.every((s) => typeof s === 'string');
const valid = (x: unknown): x is Wallet => {
  const w = x as Wallet;
  return (
    !!w &&
    Number.isInteger(w.balance) &&
    w.balance >= 0 &&
    isStrArr(w.ledger) &&
    isStrArr(w.owned) &&
    typeof w.lastDaily === 'string' &&
    typeof w.maxDay === 'string' &&
    !!w.day &&
    typeof w.day.date === 'string' &&
    isStrArr(w.day.games) &&
    isStrArr(w.day.done)
  );
};
export function recoverWallet(x: unknown): Wallet {
  const w = record(x), d = record(w.day);
  return { balance: count(w.balance), ledger: strings(w.ledger), owned: strings(w.owned),
    lastDaily: date(w.lastDaily), maxDay: date(w.maxDay), day: {
      date: date(d.date), matchCoins: Math.min(MATCH_DAILY_CAP, count(d.matchCoins)),
      matches: count(d.matches), games: strings(d.games), aiWins: count(d.aiWins),
      done: strings(d.done).filter(id => CHALLENGES.some(c => c.id === id)),
    } };
}
export const walletStore = createStore<Wallet>('jogaco.wallet.v1', 1, def, valid, recoverWallet);

const LEDGER_MAX = 400;
export const EVENT = 'clashcade:wallet';

export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lê, aplica e grava de uma vez. Retorna o resultado da função. */
function mutate<T>(fn: (w: Wallet) => T): T {
  const w = walletStore.load();
  const out = fn(w);
  if (w.ledger.length > LEDGER_MAX) w.ledger = w.ledger.slice(-LEDGER_MAX);
  walletStore.save(w);
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* fora do navegador (testes) */
  }
  return out;
}

function rollDay(w: Wallet, date: string) {
  if (date > w.maxDay) w.maxDay = date;
  if (w.day.date !== w.maxDay) w.day = emptyDay(w.maxDay);
}

function grant(w: Wallet, id: string, amount: number): boolean {
  if (w.ledger.includes(id) || amount <= 0) return false;
  w.ledger.push(id);
  w.balance += amount;
  return true;
}

export const getWallet = () => walletStore.load();

export function dailyAvailable(date = today()): boolean {
  const w = walletStore.load();
  return date > w.lastDaily && date >= w.maxDay;
}

/** Bônus diário. Só uma vez por dia; relógio voltado para trás não libera. */
export function claimDaily(date = today()): number {
  return mutate((w) => {
    if (!(date > w.lastDaily && date >= w.maxDay)) return 0;
    rollDay(w, date);
    if (!grant(w, `daily:${date}`, DAILY_BONUS)) return 0;
    w.lastDaily = date;
    return DAILY_BONUS;
  });
}

export interface MatchEvent {
  matchId: string;
  game: string;
  mode: 'ai' | 'local' | 'solo';
  /** 0 = J1 (pessoa), 1 = J2/IA, 'draw', null = sem vencedor (solo). */
  winner: 0 | 1 | 'draw' | null;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/** Partida concluída (nunca chamar para partida abandonada). Retorna fichas ganhas. */
export function rewardMatch(e: MatchEvent, date = today()): number {
  return mutate((w) => {
    if (w.ledger.includes(`match:${e.matchId}`)) return 0;
    rollDay(w, date);
    w.ledger.push(`match:${e.matchId}`);
    const d = w.day;
    d.matches++;
    if (!d.games.includes(e.game)) d.games.push(e.game);
    if (e.mode === 'ai' && e.winner === 0 && e.difficulty && e.difficulty !== 'easy') d.aiWins++;
    let got = 0;
    const room = Math.max(0, MATCH_DAILY_CAP - d.matchCoins);
    const m = Math.min(MATCH_REWARD, room);
    if (m > 0) {
      w.balance += m;
      d.matchCoins += m;
      got += m;
    }
    for (const c of CHALLENGES) {
      if (d.done.includes(c.id) || challengeProgress(w, c) < c.goal) continue;
      if (grant(w, `challenge:${d.date}:${c.id}`, c.reward)) {
        d.done.push(c.id);
        got += c.reward;
      }
    }
    return got;
  });
}

export function challengeProgress(w: Wallet, c: Challenge): number {
  const d = w.day;
  const v = c.id === 'two-matches' ? d.matches : c.id === 'two-games' ? d.games.length : d.aiWins;
  return Math.min(c.goal, v);
}

/** Desafios de hoje (sem gravar nada). */
export function challengesToday(date = today()) {
  const w = walletStore.load();
  const same = w.day.date === (date > w.maxDay ? date : w.maxDay);
  const view: Wallet = same ? w : { ...w, day: emptyDay(date) };
  return CHALLENGES.map((c) => ({ ...c, progress: challengeProgress(view, c), done: view.day.done.includes(c.id) }));
}

export const isPremiumActive = () => PREMIUM_UNLOCKED_FOR_TESTING;

/** O item pode ser usado? Padrão sempre; moedas se comprado; premium só com Premium ativo. Desconhecido = não. */
export function isUnlocked(key: string): boolean {
  const it = itemByKey(key);
  if (!it) return false;
  if (it.tier === 'default') return true;
  if (it.tier === 'premium') return isPremiumActive();
  return walletStore.load().owned.includes(key);
}

export type BuyResult = 'ok' | 'owned' | 'funds' | 'premium' | 'unknown';
/** Compra com fichas. Atômica: só debita se tudo der certo; repetir não cobra de novo. */
export function buy(key: string): BuyResult {
  const it = itemByKey(key);
  if (!it) return 'unknown';
  if (it.tier === 'default') return 'owned';
  if (it.tier === 'premium') return 'premium';
  return mutate((w) => {
    if (w.owned.includes(key)) return 'owned';
    if (w.balance < it.price) return 'funds';
    w.balance -= it.price;
    w.owned.push(key);
    w.ledger.push(`buy:${key}`);
    return 'ok';
  });
}

export { CATALOG };
