/**
 * Air Hockey — física pura (sem DOM). Unidades: metros e segundos.
 * Mesa 2,0 × 1,0 m vista de cima; Jogador 1 (coral) defende o gol da esquerda, Jogador 2 (azul) o da direita.
 */
export interface Vec {
  x: number;
  y: number;
}

/** 03/11 (Leon: disco rápido demais, peças pequenas): gol 0,34 → 0,46 para compensar disco mais lento e rebatedor maior. */
export const TABLE = { w: 2, h: 1, goal: 0.46 };
/** 03/11: 0,040 → 0,044 (+10%); rebatedor 0,065 → 0,070. No celular deitado: disco ~23 px, rebatedor ~37 px de diâmetro. */
export let PUCK_R = 0.044;
export let MALLET_R = 0.07;
/** Só para medições A/B (scripts/): troca os raios; quem importa PUCK_R/MALLET_R vê o valor novo (ligação viva do ES module). */
export function setSizesForBench(puck: number, mallet: number): void {
  PUCK_R = puck;
  MALLET_R = mallet;
}

export const AH = {
  dt: 1 / 240,
  /** Arrasto do colchão de ar (1/s): o disco quase não perde velocidade. */
  airDrag: 0.12,
  wallRestitution: 0.9,
  malletRestitution: 0.88,
  /** 01/11: 9 → 5,5 (0,36 s para cruzar). 03/11: 5,5 → 5,0 (0,40 s). Medições em scripts/ab-hockey-tamanho.ts e STATUS.md. */
  maxPuckSpeed: 5,
  /** 01/11: era 7; reduzido junto para manter o equilíbrio rebatedor × disco. */
  maxMalletSpeed: 5,
  goalsToWin: 7,
};

export interface Mallet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Para onde o jogador está levando o rebatedor. */
  tx: number;
  ty: number;
}

export type HockeyEvent = { type: 'wall'; speed: number } | { type: 'hit'; player: 0 | 1; speed: number } | { type: 'goal'; scorer: 0 | 1 };

export interface HockeyState {
  puck: { x: number; y: number; vx: number; vy: number; px: number; py: number };
  mallets: [Mallet, Mallet];
  score: [number, number];
  /** Tempo restante de pausa após gol (s). Durante a pausa nada se move. */
  freeze: number;
  /** Quem perdeu o último ponto (o disco volta no lado dele). */
  serveTo: 0 | 1;
  winner: 0 | 1 | null;
  events: HockeyEvent[];
  t: number;
}

const mallet = (x: number): Mallet => ({ x, y: TABLE.h / 2, vx: 0, vy: 0, tx: x, ty: TABLE.h / 2 });

export function createState(serveTo: 0 | 1 = 0): HockeyState {
  const s: HockeyState = {
    puck: { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0 },
    mallets: [mallet(0.25), mallet(TABLE.w - 0.25)],
    score: [0, 0],
    freeze: 0,
    serveTo,
    winner: null,
    events: [],
    t: 0,
  };
  placePuck(s, serveTo);
  return s;
}

/** Disco parado no meio do lado de quem vai sacar. */
export function placePuck(s: HockeyState, side: 0 | 1): void {
  const x = side === 0 ? TABLE.w * 0.3 : TABLE.w * 0.7;
  s.puck = { x, y: TABLE.h / 2, vx: 0, vy: 0, px: x, py: TABLE.h / 2 };
}

/** Limites do rebatedor: dentro da mesa e no próprio campo. */
export function clampMallet(p: 0 | 1, x: number, y: number): Vec {
  const r = MALLET_R;
  const minX = p === 0 ? r : TABLE.w / 2 + r;
  const maxX = p === 0 ? TABLE.w / 2 - r : TABLE.w - r;
  return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(TABLE.h - r, Math.max(r, y)) };
}

export function setTarget(s: HockeyState, p: 0 | 1, x: number, y: number): void {
  const c = clampMallet(p, x, y);
  s.mallets[p].tx = c.x;
  s.mallets[p].ty = c.y;
}

/** Avança 1 passo fixo (AH.dt). */
export function step(s: HockeyState): void {
  const dt = AH.dt;
  s.t += dt;
  const pk = s.puck;
  pk.px = pk.x;
  pk.py = pk.y;
  if (s.winner !== null) return;
  if (s.freeze > 0) {
    s.freeze = Math.max(0, s.freeze - dt);
    for (const m of s.mallets) moveMallet(m, dt);
    return;
  }
  for (const m of s.mallets) moveMallet(m, dt);

  const sp = Math.hypot(pk.vx, pk.vy);
  const n = Math.max(1, Math.ceil((sp * dt) / (PUCK_R * 0.3)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    pk.x += pk.vx * h;
    pk.y += pk.vy * h;
    collideWalls(s);
    if (s.freeze > 0) return; // gol
    s.mallets.forEach((m, idx) => collideMallet(s, m, idx as 0 | 1));
  }
  const k = Math.max(0, 1 - AH.airDrag * dt);
  pk.vx *= k;
  pk.vy *= k;
  capSpeed(pk);
}

function moveMallet(m: Mallet, dt: number): void {
  let dx = m.tx - m.x;
  let dy = m.ty - m.y;
  const d = Math.hypot(dx, dy);
  const maxStep = AH.maxMalletSpeed * dt;
  if (d > maxStep) {
    dx *= maxStep / d;
    dy *= maxStep / d;
  }
  m.vx = dx / dt;
  m.vy = dy / dt;
  m.x += dx;
  m.y += dy;
}

function capSpeed(pk: { vx: number; vy: number }) {
  const sp = Math.hypot(pk.vx, pk.vy);
  if (sp > AH.maxPuckSpeed) {
    pk.vx *= AH.maxPuckSpeed / sp;
    pk.vy *= AH.maxPuckSpeed / sp;
  }
}

function collideWalls(s: HockeyState): void {
  const pk = s.puck;
  const r = PUCK_R;
  const g0 = (TABLE.h - TABLE.goal) / 2;
  const g1 = g0 + TABLE.goal;
  const e = AH.wallRestitution;
  // laterais de cima e de baixo
  if (pk.y < r) {
    pk.y = r;
    if (pk.vy < 0) {
      s.events.push({ type: 'wall', speed: -pk.vy });
      pk.vy = -pk.vy * e;
    }
  } else if (pk.y > TABLE.h - r) {
    pk.y = TABLE.h - r;
    if (pk.vy > 0) {
      s.events.push({ type: 'wall', speed: pk.vy });
      pk.vy = -pk.vy * e;
    }
  }
  const inMouth = pk.y > g0 && pk.y < g1;
  // fundos (com a boca do gol aberta)
  for (const side of [0, 1] as const) {
    const wallX = side === 0 ? 0 : TABLE.w;
    const dir = side === 0 ? -1 : 1;
    const past = (pk.x - wallX) * dir; // >0 = além da linha
    if (inMouth) {
      // trave: cantos da boca funcionam como pontos
      for (const py of [g0, g1]) bouncePoint(s, wallX, py);
      if (past > r) {
        // gol: o centro do disco passou da linha inteira
        const scorer: 0 | 1 = side === 0 ? 1 : 0;
        s.score[scorer]++;
        s.events.push({ type: 'goal', scorer });
        s.serveTo = side;
        if (s.score[scorer] >= AH.goalsToWin) s.winner = scorer;
        s.freeze = 1.1;
        placePuck(s, side);
        return;
      }
    } else if (past > -r) {
      pk.x = wallX - dir * r;
      if (pk.vx * dir > 0) {
        s.events.push({ type: 'wall', speed: Math.abs(pk.vx) });
        pk.vx = -pk.vx * e;
      }
    }
  }
}

function bouncePoint(s: HockeyState, x: number, y: number) {
  const pk = s.puck;
  const dx = pk.x - x;
  const dy = pk.y - y;
  const d = Math.hypot(dx, dy);
  if (d >= PUCK_R || d === 0) return;
  const nx = dx / d;
  const ny = dy / d;
  pk.x = x + nx * PUCK_R;
  pk.y = y + ny * PUCK_R;
  const vn = pk.vx * nx + pk.vy * ny;
  if (vn < 0) {
    pk.vx -= (1 + AH.wallRestitution) * vn * nx;
    pk.vy -= (1 + AH.wallRestitution) * vn * ny;
    s.events.push({ type: 'wall', speed: -vn });
  }
}

/** Rebatedor = massa muito maior (cinemático): o disco reflete na velocidade relativa ao rebatedor. */
function collideMallet(s: HockeyState, m: Mallet, idx: 0 | 1): void {
  const pk = s.puck;
  const dx = pk.x - m.x;
  const dy = pk.y - m.y;
  const d = Math.hypot(dx, dy);
  const min = PUCK_R + MALLET_R;
  if (d >= min) return;
  const nx = d > 0 ? dx / d : idx === 0 ? 1 : -1;
  const ny = d > 0 ? dy / d : 0;
  pk.x = m.x + nx * min;
  pk.y = m.y + ny * min;
  const rvx = pk.vx - m.vx;
  const rvy = pk.vy - m.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    pk.vx = m.vx + rvx - (1 + AH.malletRestitution) * vn * nx;
    pk.vy = m.vy + rvy - (1 + AH.malletRestitution) * vn * ny;
    capSpeed(pk);
    s.events.push({ type: 'hit', player: idx, speed: -vn });
  }
  // o disco não pode ser empurrado para dentro da tabela: ele fica na borda e quem recua é o rebatedor
  const g0 = (TABLE.h - TABLE.goal) / 2;
  const inMouth = pk.y > g0 && pk.y < g0 + TABLE.goal;
  pk.y = Math.min(TABLE.h - PUCK_R, Math.max(PUCK_R, pk.y));
  if (!inMouth) pk.x = Math.min(TABLE.w - PUCK_R, Math.max(PUCK_R, pk.x));
  const ex = m.x - pk.x;
  const ey = m.y - pk.y;
  const ed = Math.hypot(ex, ey);
  if (ed < min) {
    const ux = ed > 0 ? ex / ed : -nx;
    const uy = ed > 0 ? ey / ed : -ny;
    const c = clampMallet(idx, pk.x + ux * min, pk.y + uy * min);
    m.x = c.x;
    m.y = c.y;
  }
}
