import { simulateShot } from '../physics/sim';
import type { Level, Vec } from '../physics/types';

/** Quanto falta pelo caminho de referência a partir de p (projeção no trecho mais próximo + resto do caminho). */
export function routeRemaining(route: Vec[], p: Vec): number {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby;
    let t = l2 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + abx * t;
    const qy = a.y + aby * t;
    let rest = Math.hypot(b.x - qx, b.y - qy);
    for (let j = i + 1; j < route.length - 1; j++) rest += Math.hypot(route[j + 1].x - route[j].x, route[j + 1].y - route[j].y);
    const off = Math.hypot(p.x - qx, p.y - qy);
    best = Math.min(best, rest + off * 1.5);
  }
  return best;
}

export interface FoundShot {
  angle: number;
  power: number;
  status: 'rest' | 'holed' | 'out' | 'moving';
  x: number;
  y: number;
  t: number;
}

/**
 * Busca exaustiva simples (ângulos × forças) da melhor tacada a partir de `from` no instante `t`.
 * Usada nos testes de "buraco solucionável" e para jogar partidas automáticas no QA.
 */
export function findShot(level: Level, from: Vec, t: number, angleStepDeg = 3, powers = [0.12, 0.2, 0.28, 0.36, 0.45, 0.55, 0.65, 0.78, 0.9, 1]): FoundShot {
  let best: FoundShot | null = null;
  let bestScore = Infinity;
  for (let deg = 0; deg < 360; deg += angleStepDeg) {
    const angle = (deg * Math.PI) / 180;
    for (const power of powers) {
      const r = simulateShot(level, from, t, angle, power);
      const score = r.status === 'holed' ? -1000 + power : r.status === 'out' ? 1e6 : routeRemaining(level.route, r);
      if (score < bestScore) {
        bestScore = score;
        best = { angle, power, status: r.status, x: r.x, y: r.y, t: r.t };
      }
    }
  }
  return best!;
}

/** Joga o buraco inteiro com a busca acima; devolve as tacadas usadas (ou null se não terminou em `max`). */
export function solveLevel(level: Level, max = 10): { strokes: number; path: Vec[] } | null {
  let pos = level.tee;
  let t = 0;
  const path: Vec[] = [pos];
  for (let k = 1; k <= max; k++) {
    const s = findShot(level, pos, t);
    if (s.status === 'holed') return { strokes: k, path: [...path, level.hole] };
    if (s.status === 'out') return null;
    pos = { x: s.x, y: s.y };
    t = s.t + 2; // tempo de mirar
    path.push(pos);
  }
  return null;
}
