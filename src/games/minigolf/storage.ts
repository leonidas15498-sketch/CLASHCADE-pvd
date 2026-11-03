import { createStore } from '../../services/storage';

export interface GolfSave {
  sound: boolean;
  music: { enabled: boolean; volume: number };
  name1: string;
  names: [string, string];
  /** Melhor total em 9 buracos (modo solo). */
  bestTotal: number | null;
  /** Melhor resultado por buraco (solo, rodada completa ou treino). */
  bestHole: (number | null)[];
  /** Rodadas solo completas. */
  rounds: number;
  /** Taco escolhido (opcional em saves antigos). Mantido para compatibilidade: é o taco do Jogador 1. */
  putter?: string;
  /** Taco de cada jogador [J1, J2] ('custom' = personalizado). */
  putters?: [string, string];
  /** Visual do campo. */
  course?: string;
  /** Rastro da bola (id de shared/fx TRAILS). */
  trail?: string;
  /** Taco personalizado de cada jogador. */
  custom?: [{ head: string; shaft: string; grip: string }, { head: string; shaft: string; grip: string }];
}

const defaults = (): GolfSave => ({
  sound: true,
  music: { enabled: true, volume: 0.4 },
  name1: '',
  names: ['', ''],
  bestTotal: null,
  bestHole: Array(9).fill(null),
  rounds: 0,
  putter: 'classico',
});

const isNumOrNull = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x));

function valid(x: unknown): x is GolfSave {
  const s = x as GolfSave;
  return (
    !!s &&
    typeof s.sound === 'boolean' &&
    !!s.music &&
    typeof s.music.enabled === 'boolean' &&
    typeof s.music.volume === 'number' &&
    typeof s.name1 === 'string' &&
    Array.isArray(s.names) &&
    isNumOrNull(s.bestTotal) &&
    Array.isArray(s.bestHole) &&
    s.bestHole.length === 9 &&
    s.bestHole.every(isNumOrNull) &&
    typeof s.rounds === 'number'
  );
}

/** Versão 1 do esquema; dados inválidos ou de outra versão voltam ao padrão. */
export const golfStore = createStore<GolfSave>('jogaco.minigolf', 1, defaults, valid);
