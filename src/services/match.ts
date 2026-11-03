/** Ponto único de fim de partida: placar de sessão + fichas + desafios. Chamar só para partida CONCLUÍDA. */
import { MatchEvent, rewardMatch } from './economy';
import { recordLocalResult } from './session';

export const newMatchId = (game: string) => `${game}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export function reportMatch(e: MatchEvent): { coins: number; session: boolean } {
  const session = recordLocalResult(e.matchId, e.mode, e.winner);
  const coins = rewardMatch(e);
  return { coins, session };
}
