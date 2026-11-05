import { createStore } from '../../services/storage';

export interface GolfSave {
  sound: boolean;
  music: { enabled: boolean; volume: number };
  name1: string;
  names: [string, string];
  /** Melhor total no circuito antigo de 9 buracos (só histórico; não é comparável com o de 12). */
  bestTotal: number | null;
  /** Melhor total no circuito completo de 12 buracos (05/11; ordem sorteada, total comparável). */
  best12?: number | null;
  /** Rodadas completas de 12 buracos. */
  rounds12?: number;
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
  bestHole: Array(HOLES).fill(null),
  best12: null,
  rounds12: 0,
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
    (s.bestHole.length === 9 || s.bestHole.length === HOLES) &&
    s.bestHole.every(isNumOrNull) &&
    typeof s.rounds === 'number'
  );
}

/** Quantidade de buracos (05/11: 9 → 12). Saves antigos com 9 recebem os 3 novos vazios, sem perder nada. */
const HOLES = 12;

function recover(x: unknown): GolfSave {
  if (!valid(x)) return defaults();
  const s = x as GolfSave;
  while (s.bestHole.length < HOLES) s.bestHole.push(null);
  if (s.best12 === undefined) s.best12 = null;
  if (s.rounds12 === undefined) s.rounds12 = 0;
  return s;
}

/** Versão 1 do esquema; dados inválidos ou de outra versão voltam ao padrão. */
export const golfStore = createStore<GolfSave>('jogaco.minigolf', 1, defaults, valid, recover);
