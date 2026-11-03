import { DEFAULT_PARAMS, PhysicsParams, TABLE, TableGeometry } from './table';
import { closestOnSegment, Vec } from './vec';

/**
 * Eixos: x para a direita, y para baixo (como na tela) e z PARA DENTRO da mesa
 * (sistema destro). O ponto de contato com o feltro fica em (0, 0, +R) a partir do centro.
 */
export interface Ball {
  /** 0 = branca, 1..7 lisas, 8 = preta, 9..15 listradas. */
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Velocidade angular (rad/s). wx/wy = rolamento/efeito alto-baixo; wz = efeito lateral. */
  wx: number;
  wy: number;
  wz: number;
  /** Orientação da bola (quatérnio unitário w,x,y,z) — só serve para desenhar o giro. */
  q: [number, number, number, number];
  /** Posição no passo anterior (para interpolação do render). */
  px: number;
  py: number;
  pocketed: boolean;
  pocketId: number | null;
}

export type ShotEvent =
  | { type: 'ball'; a: number; b: number; impulse: number; x: number; y: number }
  | { type: 'cushion'; ball: number; impulse: number }
  | { type: 'pocket'; ball: number; pocket: number };

export interface World {
  balls: Ball[];
  params: PhysicsParams;
  table: TableGeometry;
  /** Eventos gerados desde o último reset de eventos (uma tacada). */
  events: ShotEvent[];
  time: number;
}

/** Ponto de batida do taco na branca: side = esquerda(−)/direita(+), top = baixo(−)/alto(+); disco unitário. */
export interface Spin {
  side: number;
  top: number;
}

export const NO_SPIN: Spin = { side: 0, top: 0 };

export function createWorld(
  positions: Array<{ id: number; x: number; y: number }>,
  params: PhysicsParams = DEFAULT_PARAMS,
  table: TableGeometry = TABLE,
): World {
  return {
    balls: positions.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      wx: 0,
      wy: 0,
      wz: 0,
      q: [1, 0, 0, 0] as [number, number, number, number],
      px: p.x,
      py: p.y,
      pocketed: false,
      pocketId: null,
    })),
    params,
    table,
    events: [],
    time: 0,
  };
}

export function cloneWorld(w: World): World {
  return { ...w, balls: w.balls.map((b) => ({ ...b, q: [...b.q] as [number, number, number, number] })), events: [] };
}

export function getBall(w: World, id: number): Ball | undefined {
  return w.balls.find((b) => b.id === id);
}

const moving = (b: Ball) => b.vx !== 0 || b.vy !== 0 || b.wx !== 0 || b.wy !== 0;

export function isAtRest(w: World): boolean {
  for (const b of w.balls) if (!b.pocketed && moving(b)) return false;
  return true;
}

/** Converte força da barra (0..1) em velocidade inicial da branca (m/s). */
export function powerToSpeed(power: number, p: PhysicsParams = DEFAULT_PARAMS): number {
  const c = Math.min(1, Math.max(0, power));
  return p.maxCueSpeed * Math.pow(c, p.powerCurve);
}

export function speedToPower(speed: number, p: PhysicsParams = DEFAULT_PARAMS): number {
  return Math.min(1, Math.max(0, Math.pow(speed / p.maxCueSpeed, 1 / p.powerCurve)));
}

/** Limita o ponto de batida ao disco unitário. */
export function clampSpin(s: Spin): Spin {
  const r = Math.hypot(s.side, s.top);
  return r > 1 ? { side: s.side / r, top: s.top / r } : { ...s };
}

/**
 * Aplica UMA tacada: um único impulso horizontal na direção `angle`, batendo no ponto `spin`
 * da branca. Velocidade = impulso/massa; giro = (r × impulso)/I com I = 2/5·m·R².
 * Retorna false (sem efeito) se a mesa não está em repouso.
 */
export function strike(w: World, angle: number, power: number, spin: Spin = NO_SPIN): boolean {
  if (!isAtRest(w)) return false;
  const cue = getBall(w, 0);
  if (!cue || cue.pocketed) return false;
  const speed = powerToSpeed(power, w.params);
  if (speed <= 0) return false;
  const R = w.params.ballRadius;
  const s = clampSpin(spin);
  const a = s.side * w.params.maxTipOffset; // em frações de R
  const b = s.top * w.params.maxTipOffset;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // r = R·(a·p + b·cima), com p = lado direito de quem taca e cima = −z. (A componente ao longo de d não gera giro.)
  const px = -dy;
  const py = dx;
  const rx = R * a * px;
  const ry = R * a * py;
  const rz = -R * b;
  // r × d, com d = (dx, dy, 0)
  const cx = ry * 0 - rz * dy;
  const cy = rz * dx - rx * 0;
  const cz = rx * dy - ry * dx;
  const k = (5 * speed) / (2 * R * R);
  w.events = [];
  cue.vx = dx * speed;
  cue.vy = dy * speed;
  cue.wx = k * cx;
  cue.wy = k * cy;
  cue.wz = k * cz;
  return true;
}

/** Avança exatamente um passo fixo (params.dt), com subpassos adaptativos. */
export function step(w: World): void {
  const p = w.params;
  const R = p.ballRadius;
  let maxV = 0;
  let any = false;
  for (const b of w.balls) {
    b.px = b.x;
    b.py = b.y;
    if (b.pocketed) continue;
    if (moving(b)) any = true;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > maxV) maxV = sp;
  }
  if (!any) {
    w.time += p.dt;
    return;
  }
  const n = Math.min(p.maxSubsteps, Math.max(1, Math.ceil((maxV * p.dt) / (R * p.maxMovePerSubstep))));
  const h = p.dt / n;
  for (let i = 0; i < n; i++) substep(w, h);
  w.time += p.dt;
}

/** Integra a orientação: q' = ½·(0,ω)⊗q. Puramente visual, não afeta o movimento. */
function rotate(b: Ball, h: number): void {
  const [qw, qx, qy, qz] = b.q;
  const ox = b.wx * h * 0.5;
  const oy = b.wy * h * 0.5;
  const oz = b.wz * h * 0.5;
  const nw = qw - ox * qx - oy * qy - oz * qz;
  const nx = qx + ox * qw + oy * qz - oz * qy;
  const ny = qy - ox * qz + oy * qw + oz * qx;
  const nz = qz + ox * qy - oy * qx + oz * qw;
  const l = Math.hypot(nw, nx, ny, nz) || 1;
  b.q = [nw / l, nx / l, ny / l, nz / l];
}

function substep(w: World, h: number): void {
  const p = w.params;
  const R = p.ballRadius;
  const balls = w.balls;
  const muG = p.slideFriction * p.gravity;

  // 1) Integração: posição, deslizamento → rolamento, rolamento com resistência, giro vertical.
  for (const b of balls) {
    if (b.pocketed) continue;
    if (!moving(b)) {
      b.wz = 0;
      continue;
    }
    b.x += b.vx * h;
    b.y += b.vy * h;
    rotate(b, h);

    // velocidade do ponto de contato com o feltro: u = v + ω × (0,0,R)
    const ux = b.vx + R * b.wy;
    const uy = b.vy - R * b.wx;
    const us = Math.hypot(ux, uy);
    if (us > 1e-3) {
      // Deslizando: atrito constante oposto a u; u cai a 7/2·μg até a bola rolar.
      if (3.5 * muG * h >= us) {
        b.vx -= (2 / 7) * ux;
        b.vy -= (2 / 7) * uy;
        b.wx = b.vy / R;
        b.wy = -b.vx / R;
      } else {
        const ex = ux / us;
        const ey = uy / us;
        b.vx -= muG * h * ex;
        b.vy -= muG * h * ey;
        const k = (5 * muG * h) / (2 * R);
        b.wx += k * ey;
        b.wy -= k * ex;
      }
    } else {
      // Rolando: resistência de rolamento + arrasto; o giro acompanha a velocidade.
      const sp = Math.hypot(b.vx, b.vy);
      const ns = Math.max(0, sp - (p.rollDecel + p.linearDrag * sp) * h);
      const k = sp > 0 ? ns / sp : 0;
      b.vx *= k;
      b.vy *= k;
      b.wx = b.vy / R;
      b.wy = -b.vx / R;
    }
    // efeito lateral perde força com o tempo
    const dz = p.spinDecel * h;
    b.wz = Math.abs(b.wz) <= dz ? 0 : b.wz - Math.sign(b.wz) * dz;

    // repouso: velocidade e giro de rolamento desprezíveis
    if (Math.hypot(b.vx, b.vy) < p.restSpeed && R * Math.hypot(b.wx, b.wy) < p.restSpeed) {
      b.vx = b.vy = b.wx = b.wy = b.wz = 0;
    }
  }

  // 2) Colisões bola-bola (ordem fixa de pares -> determinismo). Contato sem atrito:
  //    troca a velocidade normal e preserva o giro (é isso que gera o "puxar" e o "seguir").
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const minD = 2 * R;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const pen = (minD - d) / 2;
        a.x -= nx * pen;
        a.y -= ny * pen;
        b.x += nx * pen;
        b.y += ny * pen;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const jImp = (-(1 + p.ballRestitution) * rv) / 2;
          a.vx -= jImp * nx;
          a.vy -= jImp * ny;
          b.vx += jImp * nx;
          b.vy += jImp * ny;
          if (jImp > 1e-4) w.events.push({ type: 'ball', a: a.id, b: b.id, impulse: jImp, x: a.x, y: a.y });
        }
      }
    }
  }

  // 3) Tabelas e quinas (segmentos com aberturas reais nas caçapas).
  for (const b of balls) {
    if (b.pocketed) continue;
    for (const s of w.table.segments) {
      const c = closestOnSegment(b, s.a, s.b);
      const dx = b.x - c.x;
      const dy = b.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      b.x = c.x + nx * R;
      b.y = c.y + ny * R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const tx = -ny;
        const ty = nx;
        const vt = b.vx * tx + b.vy * ty;
        const nvn = -vn * p.cushionRestitution;
        // Atrito na tabela: o efeito lateral (wz) "puxa" a saída para um lado (limitado por μ·impulso normal).
        const slip = vt - R * b.wz;
        const jMax = p.cushionFriction * (1 + p.cushionRestitution) * -vn;
        const dvt = -Math.max(-jMax, Math.min(jMax, (2 / 7) * slip));
        const nvt = vt + dvt;
        b.wz -= (5 / (2 * R)) * dvt;
        b.vx = nx * nvn + tx * nvt;
        b.vy = ny * nvn + ty * nvt;
        // A tabela bate acima do centro e "come" parte do giro de rolamento.
        b.wx = (p.cushionRollKeep * b.vy) / R;
        b.wy = (-p.cushionRollKeep * b.vx) / R;
        w.events.push({ type: 'cushion', ball: b.id, impulse: -vn });
      }
    }
  }

  // 4) Caçapas: captura só quando o centro alcança a zona além da boca.
  for (const b of balls) {
    if (b.pocketed) continue;
    for (const pk of w.table.pockets) {
      const dx = b.x - pk.center.x;
      const dy = b.y - pk.center.y;
      if (dx * dx + dy * dy < pk.captureRadius * pk.captureRadius) {
        pocketBall(w, b, pk.id);
        break;
      }
    }
    // Rede de segurança: se uma bola escapar dos limites (não deveria), cai na caçapa mais próxima.
    if (!b.pocketed && isOutside(w, b)) {
      let best = 0;
      let bd = Infinity;
      for (const pk of w.table.pockets) {
        const dd = Math.hypot(b.x - pk.center.x, b.y - pk.center.y);
        if (dd < bd) {
          bd = dd;
          best = pk.id;
        }
      }
      pocketBall(w, b, best);
    }
  }
}

function isOutside(w: World, b: Vec): boolean {
  const m = 0.12;
  return b.x < -m || b.y < -m || b.x > w.table.length + m || b.y > w.table.width + m;
}

function pocketBall(w: World, b: Ball, pocket: number): void {
  b.pocketed = true;
  b.pocketId = pocket;
  b.vx = b.vy = b.wx = b.wy = b.wz = 0;
  w.events.push({ type: 'pocket', ball: b.id, pocket });
}

/** Simula até o repouso (ou limite de tempo). Usado por testes e pela IA. */
export function simulateUntilRest(w: World, maxSeconds = 40): number {
  let steps = 0;
  const maxSteps = Math.ceil(maxSeconds / w.params.dt);
  while (!isAtRest(w) && steps < maxSteps) {
    step(w);
    steps++;
  }
  return steps;
}

/** Posição válida para a branca (dentro da mesa, sem sobrepor bolas). */
export function isValidCuePlacement(w: World, x: number, y: number, maxX?: number): boolean {
  const R = w.params.ballRadius;
  const L = w.table.length;
  const W = w.table.width;
  if (x < R || y < R || x > L - R || y > W - R) return false;
  if (maxX !== undefined && x > maxX) return false;
  for (const b of w.balls) {
    if (b.id === 0 || b.pocketed) continue;
    if (Math.hypot(b.x - x, b.y - y) < 2 * R + 1e-4) return false;
  }
  // Evita colocar sobre a área de captura de uma caçapa.
  for (const pk of w.table.pockets) {
    if (Math.hypot(pk.center.x - x, pk.center.y - y) < pk.captureRadius + R) return false;
  }
  return true;
}
