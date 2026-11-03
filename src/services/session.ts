/**
 * Placar de sessão social VERMELHO × AZUL (entre todos os jogos 2P locais).
 * Só vitória de 2P local conta, uma vez por partida (matchId). Empate, IA, solo e partida abandonada não contam.
 * "Nova sessão" zera só este placar (não mexe em recordes, fichas nem cosméticos).
 */
import { createStore } from './storage';

export interface Session {
  red: number;
  blue: number;
  ids: string[];
  startedAt: string;
}
const def = (): Session => ({ red: 0, blue: 0, ids: [], startedAt: new Date().toISOString() });
const valid = (x: unknown): x is Session => {
  const s = x as Session;
  return !!s && Number.isInteger(s.red) && Number.isInteger(s.blue) && s.red >= 0 && s.blue >= 0 && Array.isArray(s.ids) && typeof s.startedAt === 'string';
};
export const sessionStore = createStore<Session>('jogaco.session.v1', 1, def, valid);
export const SESSION_EVENT = 'clashcade:session';

const emit = () => {
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT));
  } catch {
    /* testes */
  }
};

/** Retorna true se contou agora (false = repetida, empate ou não é 2P local). */
export function recordLocalResult(matchId: string, mode: string, winner: 0 | 1 | 'draw' | null): boolean {
  if (mode !== 'local' || (winner !== 0 && winner !== 1)) return false;
  const s = sessionStore.load();
  if (s.ids.includes(matchId)) return false;
  s.ids.push(matchId);
  if (s.ids.length > 300) s.ids = s.ids.slice(-300);
  if (winner === 0) s.red++;
  else s.blue++;
  sessionStore.save(s);
  emit();
  return true;
}

export const getSession = () => sessionStore.load();

export function newSession() {
  sessionStore.save(def());
  emit();
}
