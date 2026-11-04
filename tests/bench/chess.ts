/**
 * Medição da IA do Xadrez: pontuação de A contra B (vitória 1, empate 0,5), alternando as cores. Números no STATUS.md.
 * Partida que chega ao teto de lances é adjudicada pela avaliação (±3 peões), como em torneios de motores.
 */
import { makeRng } from '../../src/games/pool/ai/ai';
import type { Difficulty } from '../../src/games/shared/shell';
import { chooseChess, evaluate } from '../../src/games/chess/ai';
import { applyMove, createChess } from '../../src/games/chess/logic';

/** Tempo por lance reduzido para o teste caber (a profundidade máxima continua a do nível). */
const MS: Record<Difficulty, number> = { easy: 100, medium: 400, hard: 900 };

export function chessDuel(a: Difficulty, b: Difficulty, n = 6, seed = 7, maxPlies = 160): { score: number; wins: number; draws: number } {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const rng = makeRng(seed * 131 + i);
    const s = createChess();
    const aSide = i % 2;
    while (s.winner === null && s.plies < maxPlies) {
      const d = s.current === aSide ? a : b;
      applyMove(s, chooseChess(s, d, rng, MS[d]));
    }
    // sem fim até o teto de lances: decide pela avaliação (vantagem de 3 peões ou mais = vitória por adjudicação)
    const adv = s.winner === null ? evaluate(s) * (s.current === aSide ? 1 : -1) : 0;
    if (s.winner === aSide || adv >= 300) wins++;
    else if (s.winner === 'draw' || (s.winner === null && adv > -300)) draws++;
  }
  return { score: (wins + draws * 0.5) / n, wins, draws };
}
