import { record, count, text } from '../../../services/validation';
import type { Difficulty } from '../rules/rules';

export interface Prefs {
  sound: boolean;
  power: number;
  difficulty: Difficulty;
  names: [string, string];
  playerName: string;
  /** Segundos por tacada (0 = sem limite). */
  shotTime: number;
  /** Taco escolhido (id do catálogo). */
  cue: string;
  /** Taco de cada jogador [J1, J2/IA] (opcional em dados antigos). */
  cues?: [string, string];
  /** Tema visual da mesa. */
  table?: string;
  /** Rastro da bola branca (id de shared/fx TRAILS). */
  trail?: string;
  /** Música de fundo ligada e volume (0..1). */
  music: boolean;
  musicVolume: number;
}

export interface Stats {
  ai: Record<Difficulty, { w: number; l: number }>;
  /** Histórico local de 2P (somente neste aparelho, sem ranking). */
  local: Array<{ at: string; p1: string; p2: string; winner: string }>;
}

const PREFS_KEY = 'sinuca8.prefs.v1';
const STATS_KEY = 'sinuca8.stats.v1';

const defaultPrefs = (): Prefs => ({ sound: true, power: 0.35, difficulty: 'medium', names: ['Jogador 1', 'Jogador 2'], playerName: 'Você', shotTime: 45, cue: 'classico', music: true, musicVolume: 0.4 });
const defaultStats = (): Stats => ({ ai: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } }, local: [] });

function read(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return record(JSON.parse(raw));
  } catch {
    return {};
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível (aba privada etc.): o jogo segue sem persistir */
  }
}

export function loadPrefs(): Prefs {
  const p = read(PREFS_KEY), d = defaultPrefs();
  const unit = (x: unknown, fallback: number) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1 ? x : fallback;
  const pair = (x: unknown, fallback: [string, string]): [string, string] => Array.isArray(x) ? [text(x[0], fallback[0]), text(x[1], fallback[1])] : fallback;
  return { ...d, sound: typeof p.sound === 'boolean' ? p.sound : d.sound,
    power: unit(p.power, d.power), musicVolume: unit(p.musicVolume, d.musicVolume),
    music: typeof p.music === 'boolean' ? p.music : d.music,
    difficulty: p.difficulty === 'easy' || p.difficulty === 'medium' || p.difficulty === 'hard' ? p.difficulty : d.difficulty,
    names: pair(p.names, d.names), playerName: text(p.playerName, d.playerName),
    shotTime: [0,30,45,60].includes(p.shotTime as number) ? p.shotTime as number : d.shotTime,
    cue: text(p.cue, d.cue), cues: Array.isArray(p.cues) ? pair(p.cues, [text(p.cue, d.cue), 'ebano']) : undefined,
    table: typeof p.table === 'string' ? p.table : undefined, trail: typeof p.trail === 'string' ? p.trail : undefined };
}
export const savePrefs = (p: Prefs) => write(PREFS_KEY, p);
export function loadStats(): Stats {
  const s = read(STATS_KEY), ai = record(s.ai), out = defaultStats();
  for (const level of ['easy', 'medium', 'hard'] as const) {
    const r = record(ai[level]); out.ai[level] = { w: count(r.w), l: count(r.l) };
  }
  out.local = Array.isArray(s.local) ? s.local.flatMap(v => {
    const r = record(v);
    return ['at','p1','p2','winner'].every(k => typeof r[k] === 'string')
      ? [{ at: r.at as string, p1: r.p1 as string, p2: r.p2 as string, winner: r.winner as string }] : [];
  }) : [];
  return out;
}
export const saveStats = (s: Stats) => write(STATS_KEY, s);
export const resetStats = () => write(STATS_KEY, defaultStats());
