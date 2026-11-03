import type { GameController } from '../game/controller';
import { aimRaycast, pathClear } from '../physics/raycast';
import { DEFAULT_PARAMS, PhysicsParams } from '../physics/table';
import { Vec } from '../physics/vec';
import { cloneWorld, getBall, isValidCuePlacement, simulateUntilRest, speedToPower, strike, World } from '../physics/world';
import { Difficulty, evaluateShot, isOnEight, legalTargets, MatchState, summarizeShot } from '../rules/rules';

export interface AIShot {
  angle: number;
  power: number;
  calledPocket: number | null;
  cuePos: Vec | null;
  kind: 'break' | 'pot' | 'safety' | 'fallback';
  target: number | null;
  pocket: number | null;
}

export interface DifficultyConfig {
  /** Desvio-padrão do erro angular (graus). */
  angleSigmaDeg: number;
  /** Desvio-padrão relativo do erro de força. */
  powerSigma: number;
  /** Quantas candidatas são verificadas por simulação (0 = nenhuma). */
  simulate: number;
  /** Variações de força testadas por candidata. */
  powerVariants: number[];
  /** Escolhe aleatoriamente entre as N melhores (sem simulação). */
  pickAmongTop: number;
  breakPower: number;
  /** Jogo de posição: entre tacadas que encaçapam, prefere a que deixa a branca com boa próxima tacada. */
  positionPlay: boolean;
}

/**
 * Níveis recalibrados em 01/11 (medição em tests/bench/pool.ts, números no STATUS.md).
 * O erro angular domina: 0,85° já fazia o Médio errar quase tudo; agora Médio ≈ metade das tacadas, Difícil ≈ 8 em 10.
 */
export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { angleSigmaDeg: 0.85, powerSigma: 0.1, simulate: 0, powerVariants: [1], pickAmongTop: 2, breakPower: 0.75, positionPlay: false },
  medium: { angleSigmaDeg: 0.35, powerSigma: 0.05, simulate: 6, powerVariants: [1], pickAmongTop: 1, breakPower: 0.9, positionPlay: false },
  hard: { angleSigmaDeg: 0.12, powerSigma: 0.025, simulate: 12, powerVariants: [1, 1.3, 0.8], pickAmongTop: 1, breakPower: 1, positionPlay: true },
};

/** PRNG determinístico (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Distância rolando até parar, partindo de v0, com dv/dt = −a − k·v. */
function rollDistance(v0: number, p: PhysicsParams): number {
  const a = p.rollDecel;
  const k = p.linearDrag;
  return v0 / k - (a / (k * k)) * Math.log(1 + (k * v0) / a);
}

/**
 * Distância até parar de uma bola que sai SEM giro (tacada no centro ou bola atingida):
 * desliza até cair para 5/7 da velocidade e depois rola.
 */
function stopDistance(v0: number, p: PhysicsParams): number {
  const vr = (5 / 7) * v0;
  const slide = (v0 * v0 - vr * vr) / (2 * p.slideFriction * p.gravity);
  return slide + rollDistance(vr, p);
}

/** Inverte stopDistance por bissecção. */
function speedForDistance(d: number, p: PhysicsParams): number {
  let lo = 0;
  let hi = 20;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (stopDistance(mid, p) < d) lo = mid;
    else hi = mid;
  }
  return hi;
}

interface Candidate {
  target: number;
  pocket: number;
  angle: number;
  power: number;
  score: number;
}

/** Gera tacadas diretas (branca → bola-alvo → caçapa) geometricamente viáveis a partir da posição atual. */
export function potCandidates(w: World, match: MatchState, cuePos?: Vec): Candidate[] {
  const p = w.params;
  const R = p.ballRadius;
  const cue = getBall(w, 0)!;
  const C = cuePos ?? { x: cue.x, y: cue.y };
  const onTable = w.balls.filter((b) => !b.pocketed).map((b) => b.id);
  const targets = legalTargets(match, match.current, onTable);
  const out: Candidate[] = [];
  const sim = cloneWorld(w);
  const c2 = getBall(sim, 0)!;
  c2.x = C.x;
  c2.y = C.y;
  for (const id of targets) {
    const B = getBall(w, id)!;
    for (const pk of w.table.pockets) {
      const ax = pk.aim.x - B.x;
      const ay = pk.aim.y - B.y;
      const d2 = Math.hypot(ax, ay);
      if (d2 < 1e-6) continue;
      const ux = ax / d2;
      const uy = ay / d2;
      // ângulo de entrada na boca da caçapa
      const entry = ux * pk.axis.x + uy * pk.axis.y;
      if (entry < (pk.kind === 'side' ? 0.55 : 0.4)) continue;
      const G = { x: B.x - ux * 2 * R, y: B.y - uy * 2 * R };
      const gx = G.x - C.x;
      const gy = G.y - C.y;
      const d1 = Math.hypot(gx, gy);
      if (d1 < 1e-6) continue;
      const cosCut = (gx * ux + gy * uy) / d1;
      if (cosCut < 0.25) continue;
      const angle = Math.atan2(gy, gx);
      // linha da branca até a bola fantasma livre (mesma geometria da guia)
      const hit = aimRaycast(sim, angle);
      if (hit.kind !== 'ball' || hit.ballId !== id || Math.abs(hit.t - d1) > 0.003) continue;
      if (!pathClear(w, B, pk.aim, 2 * R, [0, id])) continue;
      // força estimada: bola-alvo chega à caçapa com folga, branca chega à bola com a velocidade necessária
      const vObj = speedForDistance(d2 + 0.55, p); // folga: a bola-alvo passaria 55 cm da boca (erro de força não deixa curta)
      const u = vObj / (cosCut * ((1 + p.ballRestitution) / 2));
      const vCue = speedForDistance(d1 + stopDistance(u, p), p);
      if (vCue > p.maxCueSpeed * 1.02) continue;
      const power = Math.min(1, Math.max(0.12, speedToPower(vCue * 1.08, p)));
      const score = (cosCut * cosCut * Math.min(1, entry + 0.2)) / (1 + d1 * 0.5 + d2 * 0.9);
      out.push({ target: id, pocket: pk.id, angle, power, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

interface Outcome {
  value: number;
  /** Mundo após a tacada (para avaliar a posição da branca). */
  after?: World;
}

/** Simula a tacada sem erro e avalia pelas regras. Mesma física e mesmas regras do humano. */
function evaluateBySim(w: World, match: MatchState, angle: number, power: number, called: number | null, cuePos: Vec | null): Outcome {
  const sim = cloneWorld(w);
  const c = getBall(sim, 0)!;
  if (cuePos) {
    c.x = cuePos.x;
    c.y = cuePos.y;
  }
  const before = sim.balls.filter((b) => !b.pocketed).map((b) => b.id);
  if (!strike(sim, angle, power)) return { value: -100 };
  simulateUntilRest(sim, 30);
  const sum = summarizeShot(sim.events);
  const res = evaluateShot({ ...match, calledPocket: called }, sum, before);
  const me = match.current;
  if (res.state.winner === me) return { value: 100 };
  if (res.state.winner !== null) return { value: -100 };
  if (res.foul) return { value: -10 };
  if (res.continued) return { value: 10, after: sim };
  return { value: 0 };
}

function placeCueForBallInHand(g: GameController, rng: () => number): Vec | null {
  const w = g.world;
  const R = w.params.ballRadius;
  const maxX = g.maxCueX();
  // Para cada bola-alvo/caçapa, tenta posicionar a branca atrás da bola fantasma (tacada reta).
  const onTable = g.onTable();
  const targets = legalTargets(g.match, g.match.current, onTable);
  let best: { pos: Vec; score: number } | null = null;
  for (const id of targets) {
    const B = getBall(w, id)!;
    for (const pk of w.table.pockets) {
      const d = Math.hypot(pk.aim.x - B.x, pk.aim.y - B.y);
      const ux = (pk.aim.x - B.x) / d;
      const uy = (pk.aim.y - B.y) / d;
      for (const back of [0.25, 0.4, 0.15, 0.6]) {
        for (const off of [0, 0.15, -0.15]) {
          // pequena variação lateral produz um corte leve, ainda fácil
          const ang = Math.atan2(uy, ux) + off;
          const pos = { x: B.x - Math.cos(ang) * (2 * R + back), y: B.y - Math.sin(ang) * (2 * R + back) };
          if (!isValidCuePlacement(w, pos.x, pos.y, maxX)) continue;
          const cands = potCandidates(w, g.match, pos).filter((c) => c.target === id && c.pocket === pk.id);
          if (!cands.length) continue;
          const sc = cands[0].score + rng() * 1e-3;
          if (!best || sc > best.score) best = { pos, score: sc };
        }
      }
    }
  }
  if (best) return best.pos;
  // nenhuma: procura qualquer ponto válido próximo do centro da área permitida
  const cx = maxX !== undefined ? maxX / 2 : w.table.length / 2;
  for (let k = 0; k < 200; k++) {
    const x = cx + (rng() - 0.5) * (maxX !== undefined ? maxX : w.table.length) * 0.9;
    const y = w.table.width / 2 + (rng() - 0.5) * w.table.width * 0.8;
    if (isValidCuePlacement(w, x, y, maxX)) return { x, y };
  }
  return null;
}

/** Tacada de segurança: toca uma bola legal de forma direta com força suficiente para alguma bola atingir a tabela. */
function safetyShot(g: GameController, cfg: DifficultyConfig, cuePos: Vec | null): { angle: number; power: number } | null {
  const w = g.world;
  const cue = getBall(w, 0)!;
  const C = cuePos ?? { x: cue.x, y: cue.y };
  const sim = cloneWorld(w);
  const c2 = getBall(sim, 0)!;
  c2.x = C.x;
  c2.y = C.y;
  const legal = new Set(legalTargets(g.match, g.match.current, g.onTable()));
  const options: Array<{ angle: number; power: number; d: number }> = [];
  for (let i = 0; i < 360; i++) {
    const angle = (i / 360) * Math.PI * 2;
    const hit = aimRaycast(sim, angle);
    if (hit.kind === 'ball' && legal.has(hit.ballId!)) {
      const power = Math.min(1, speedToPower(speedForDistance(hit.t + 0.9, w.params), w.params));
      options.push({ angle, power, d: hit.t });
    }
  }
  if (!options.length) return null;
  options.sort((a, b) => a.d - b.d);
  if (cfg.simulate === 0) return options[0];
  // verifica por simulação as primeiras opções e evita faltas
  const step = Math.max(1, Math.floor(options.length / 12));
  for (let i = 0; i < options.length; i += step) {
    const o = options[i];
    if (evaluateBySim(w, g.match, o.angle, o.power, g.match.calledPocket, cuePos).value >= 0) return o;
  }
  return options[0];
}

/**
 * Escolhe a tacada da IA. Não altera o jogo: o chamador aplica `cuePos`/`calledPocket`
 * e dispara `shoot(angle, power)` — o mesmo caminho do jogador humano.
 */
export function chooseAIShot(g: GameController, difficulty: Difficulty, rng: () => number): AIShot {
  const cfg = DIFFICULTY[difficulty];
  const w = g.world;
  const m = g.match;
  let cuePos: Vec | null = null;

  if (m.isBreak) {
    const hs = w.table.headSpot;
    cuePos = { x: hs.x, y: hs.y + (rng() - 0.5) * 0.1 };
    const apex = getBall(w, 1)!;
    const angle = Math.atan2(apex.y - cuePos.y, apex.x - cuePos.x);
    return finalize({ angle, power: cfg.breakPower, calledPocket: null, cuePos, kind: 'break', target: 1, pocket: null });
  }

  if (m.ballInHand !== 'none') cuePos = placeCueForBallInHand(g, rng);

  const onEight = isOnEight(m, m.current, g.onTable());
  const cands = potCandidates(w, m, cuePos ?? undefined);

  let chosen: Candidate | null = null;
  if (cands.length) {
    if (cfg.simulate > 0) {
      let bestVal = -Infinity;
      for (const c of cands.slice(0, cfg.simulate)) {
        for (const mul of cfg.powerVariants) {
          const pw = Math.min(1, c.power * mul);
          const out = evaluateBySim(w, m, c.angle, pw, onEight ? c.pocket : null, cuePos);
          let val = out.value + c.score;
          if (cfg.positionPlay && out.after) {
            // próxima tacada a partir de onde a branca parou (mesmo jogador, mesmo grupo)
            const next = potCandidates(out.after, m);
            val += next.length ? 2 + Math.min(3, next[0].score * 6) : 0;
          }
          if (val > bestVal) {
            bestVal = val;
            chosen = { ...c, power: pw };
          }
        }
      }
      if (bestVal < 0) chosen = null; // todas as diretas resultam em falta/derrota: prefere segurança
    } else {
      const n = Math.min(cfg.pickAmongTop, cands.length);
      chosen = cands[Math.floor(rng() * n)];
    }
  }

  if (chosen) {
    return finalize({
      angle: chosen.angle,
      power: chosen.power,
      calledPocket: onEight ? chosen.pocket : null,
      cuePos,
      kind: 'pot',
      target: chosen.target,
      pocket: chosen.pocket,
    });
  }

  const safe = safetyShot(g, cfg, cuePos);
  const called = onEight ? nearestPocketTo8(w) : null;
  if (safe) return finalize({ ...safe, calledPocket: called, cuePos, kind: 'safety', target: null, pocket: null });

  // último recurso: mira no centro da bola legal mais próxima
  const cue = getBall(w, 0)!;
  const C = cuePos ?? cue;
  const legal = legalTargets(m, m.current, g.onTable());
  let angle = rng() * Math.PI * 2;
  let bd = Infinity;
  for (const id of legal) {
    const b = getBall(w, id)!;
    const d = Math.hypot(b.x - C.x, b.y - C.y);
    if (d < bd) {
      bd = d;
      angle = Math.atan2(b.y - C.y, b.x - C.x);
    }
  }
  return finalize({ angle, power: 0.5, calledPocket: called, cuePos, kind: 'fallback', target: null, pocket: null });

  function finalize(s: AIShot): AIShot {
    const angle = s.angle + (gauss(rng) * cfg.angleSigmaDeg * Math.PI) / 180;
    const power = Math.min(1, Math.max(0.05, s.power * (1 + gauss(rng) * cfg.powerSigma)));
    return { ...s, angle, power };
  }
}

function nearestPocketTo8(w: World): number {
  const e = getBall(w, 8)!;
  let best = 0;
  let bd = Infinity;
  for (const pk of w.table.pockets) {
    const d = Math.hypot(pk.aim.x - e.x, pk.aim.y - e.y);
    if (d < bd) {
      bd = d;
      best = pk.id;
    }
  }
  return best;
}

export const _internals = { stopDistance, speedForDistance, DEFAULT_PARAMS };
