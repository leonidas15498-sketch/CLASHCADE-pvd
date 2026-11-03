import { GOLF, GolfParams, Level, Mover, Vec } from './types';

/** Estado de uma bola em movimento num buraco. */
export interface GolfWorld {
  level: Level;
  params: GolfParams;
  /** Tempo global do buraco (s) — define a posição dos obstáculos móveis. */
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Posição no passo anterior (interpolação do desenho). */
  px: number;
  py: number;
  status: 'rest' | 'moving' | 'holed' | 'out';
  /** Tempo desde a tacada. */
  shotTime: number;
  events: GolfEvent[];
  /** Bola está sobre o buraco neste passo (para detectar quando sai sem cair). */
  overCup?: boolean;
}

export type GolfEvent = { type: 'wall'; speed: number } | { type: 'holed' } | { type: 'out' } | { type: 'lip' };

/** Segmento (cápsula) de obstáculo no instante t, com a velocidade de cada ponto. */
interface LiveSeg {
  a: Vec;
  b: Vec;
  r: number;
  e: number;
  vel: (p: Vec) => Vec;
}

const ZERO = () => ({ x: 0, y: 0 });

export function createWorld(level: Level, pos: Vec = level.tee, t = 0, params: GolfParams = GOLF): GolfWorld {
  return { level, params, t, x: pos.x, y: pos.y, vx: 0, vy: 0, px: pos.x, py: pos.y, status: 'rest', shotTime: 0, events: [] };
}

/**
 * Força da barra → velocidade inicial. Com desaceleração constante a distância é v²/2a, então usar
 * v = vmax·√força deixa a DISTÂNCIA proporcional à força (50% ≈ metade do caminho), mais fácil de dosar.
 */
export function powerToSpeed(power: number, p: GolfParams = GOLF): number {
  return p.maxSpeed * Math.sqrt(Math.min(1, Math.max(0, power)));
}

/** Uma tacada = um único impulso. Recusada se a bola não estiver parada. */
export function strike(w: GolfWorld, angle: number, power: number): boolean {
  if (w.status !== 'rest') return false;
  const v = powerToSpeed(power, w.params);
  if (v <= 0) return false;
  w.vx = Math.cos(angle) * v;
  w.vy = Math.sin(angle) * v;
  w.status = 'moving';
  w.shotTime = 0;
  w.events = [];
  w.overCup = false;
  return true;
}

/** Segmentos dos obstáculos móveis no instante t. */
export function moverSegments(m: Mover, t: number): LiveSeg[] {
  if (m.kind === 'rotor') {
    const out: LiveSeg[] = [];
    const vel = (p: Vec) => ({ x: -m.speed * (p.y - m.center.y), y: m.speed * (p.x - m.center.x) });
    for (let i = 0; i < m.arms; i++) {
      const th = m.phase + m.speed * t + (2 * Math.PI * i) / m.arms;
      out.push({
        a: m.center,
        b: { x: m.center.x + Math.cos(th) * m.length, y: m.center.y + Math.sin(th) * m.length },
        r: m.r,
        e: 0.6,
        vel,
      });
    }
    return out;
  }
  const w = (2 * Math.PI) / m.period;
  const s = Math.sin(w * t + m.phase);
  const c = Math.cos(w * t + m.phase) * w;
  const ox = m.travel.x * s;
  const oy = m.travel.y * s;
  const v = { x: m.travel.x * c, y: m.travel.y * c };
  const x0 = m.x + ox;
  const y0 = m.y + oy;
  const pts = [
    { x: x0, y: y0 },
    { x: x0 + m.w, y: y0 },
    { x: x0 + m.w, y: y0 + m.h },
    { x: x0, y: y0 + m.h },
  ];
  return pts.map((a, i) => ({ a, b: pts[(i + 1) % 4], r: 0, e: 0.6, vel: () => v }));
}

export function sliderRect(m: Extract<Mover, { kind: 'slider' }>, t: number) {
  const s = Math.sin(((2 * Math.PI) / m.period) * t + m.phase);
  return { x: m.x + m.travel.x * s, y: m.y + m.travel.y * s, w: m.w, h: m.h };
}

export function pointInPoly(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function closest(p: Vec, a: Vec, b: Vec): Vec {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function zoneAt(w: GolfWorld, kind: 'slope' | 'sand' | 'water') {
  return w.level.zones.find((z) => z.kind === kind && pointInPoly(w, z.poly));
}

/** Avança um passo fixo. */
export function step(w: GolfWorld): void {
  const p = w.params;
  w.px = w.x;
  w.py = w.y;
  if (w.status !== 'moving') {
    w.t += p.dt;
    return;
  }
  const sp = Math.hypot(w.vx, w.vy);
  const n = Math.min(p.maxSubsteps, Math.max(1, Math.ceil((sp * p.dt) / (p.ballR * p.maxMovePerSubstep))));
  const h = p.dt / n;
  for (let i = 0; i < n && w.status === 'moving'; i++) substep(w, h);
  w.t += p.dt;
  w.shotTime += p.dt;
  if (w.status === 'moving' && w.shotTime > p.maxShotSeconds) {
    w.vx = w.vy = 0;
    w.status = 'rest';
  }
}

function substep(w: GolfWorld, h: number): void {
  const p = w.params;
  const R = p.ballR;
  const tNow = w.t; // obstáculos móveis avaliados no instante do passo

  // 1) rampa (aceleração constante) + atrito de rolamento/areia
  const slope = zoneAt(w, 'slope');
  if (slope && slope.kind === 'slope') {
    w.vx += slope.accel.x * h;
    w.vy += slope.accel.y * h;
  }
  const sand = !!zoneAt(w, 'sand');
  const sp = Math.hypot(w.vx, w.vy);
  const decel = p.rollDecel + (sand ? p.sandDecel : 0) + p.drag * sp;
  const ns = Math.max(0, sp - decel * h);
  if (sp > 0) {
    w.vx *= ns / sp;
    w.vy *= ns / sp;
  }
  w.x += w.vx * h;
  w.y += w.vy * h;

  // 2) paredes fixas, para-choques e obstáculos móveis (cápsulas)
  const collideSeg = (a: Vec, b: Vec, r: number, e: number, vel: (q: Vec) => Vec) => {
    const c = closest(w, a, b);
    const dx = w.x - c.x;
    const dy = w.y - c.y;
    const d = Math.hypot(dx, dy);
    const min = R + r;
    if (d >= min || d === 0) return;
    const nx = dx / d;
    const ny = dy / d;
    w.x = c.x + nx * min;
    w.y = c.y + ny * min;
    const vp = vel(c);
    const rx = w.vx - vp.x;
    const ry = w.vy - vp.y;
    const vn = rx * nx + ry * ny;
    if (vn < 0) {
      const tx = -ny;
      const ty = nx;
      const vt = rx * tx + ry * ty;
      const nvn = -vn * e;
      const nvt = vt * p.wallTangentKeep;
      w.vx = vp.x + nx * nvn + tx * nvt;
      w.vy = vp.y + ny * nvn + ty * nvt;
      w.events.push({ type: 'wall', speed: -vn });
    }
  };
  for (const s of w.level.walls) collideSeg(s.a, s.b, s.r, s.restitution ?? p.wallRestitution, ZERO);
  for (const bmp of w.level.bumpers) collideSeg(bmp.c, bmp.c, bmp.r, bmp.restitution ?? 0.62, ZERO);
  for (const m of w.level.movers) for (const s of moverSegments(m, tNow)) collideSeg(s.a, s.b, s.r, s.e, s.vel);

  // 3) buraco: cai se passar perto do centro devagar o bastante
  const hx = w.x - w.level.hole.x;
  const hy = w.y - w.level.hole.y;
  const hd = Math.hypot(hx, hy);
  if (hd < p.holeR) {
    const v = Math.hypot(w.vx, w.vy);
    // expoente 0,35 (era 0,5): mesma velocidade pelo centro, borda ~30% mais tolerante (01/11, pedido do Leon)
    const limit = p.holeCaptureSpeed * Math.max(0, 1 - (hd / p.holeR) ** 2) ** 0.35;
    if (v <= limit || v < 1.5) {
      // fica onde caiu; a animação leva a bola até o centro do copo
      w.vx = w.vy = 0;
      w.status = 'holed';
      w.events.push({ type: 'holed' });
      return;
    }
    // rápido demais: passa por cima e a borda do copo desvia um pouco a bola (uma vez por passagem)
    if (!w.overCup) {
      const k = 0.12 * (1 - hd / p.holeR);
      w.vx -= (hx / (hd || 1)) * v * k;
      w.vy -= (hy / (hd || 1)) * v * k;
      w.overCup = true;
    }
  } else if (w.overCup) {
    // saiu do buraco sem cair: evento 'lip' (som + aviso "forte demais" na UI)
    w.overCup = false;
    w.events.push({ type: 'lip' });
  }

  // 4) fora de campo (água ou fora do gramado)
  if (!pointInPoly(w, w.level.green) || zoneAt(w, 'water')) {
    w.vx = w.vy = 0;
    w.status = 'out';
    w.events.push({ type: 'out' });
    return;
  }

  // 5) repouso — numa rampa mais íngreme que o atrito, a bola não para (desce)
  const s2 = Math.hypot(w.vx, w.vy);
  if (s2 < p.restSpeed) {
    const sl = zoneAt(w, 'slope');
    const pull = sl && sl.kind === 'slope' ? Math.hypot(sl.accel.x, sl.accel.y) : 0;
    if (pull <= p.rollDecel) {
      w.vx = w.vy = 0;
      w.status = 'rest';
      settleAwayFromMovers(w);
      // A moving obstacle correction must still obey the original field rules.
      if (!pointInPoly(w, w.level.green) || zoneAt(w, 'water')) {
        w.status = 'out';
        w.events.push({ type: 'out' });
      }
    }
  }
}

/**
 * Se a bola parar dentro da área varrida por um obstáculo móvel, ela é empurrada para fora
 * (como se o obstáculo a tivesse empurrado) — evita pá atravessando bola parada.
 */
export function settleAwayFromMovers(w: GolfWorld): void {
  const R = w.params.ballR;
  for (const m of w.level.movers) {
    if (m.kind === 'rotor') {
      const dx = w.x - m.center.x;
      const dy = w.y - m.center.y;
      const d = Math.hypot(dx, dy);
      const need = m.length + R + m.r + 0.15;
      if (d < need) {
        // sai na direção do eixo do corredor (x), mantendo a altura
        const sx = Math.sign(dx) || -1;
        const ox = Math.sqrt(Math.max(0, need * need - dy * dy));
        w.x = m.center.x + sx * ox;
      }
    } else {
      const minY = m.y - Math.abs(m.travel.y) - R - 0.15;
      const maxY = m.y + m.h + Math.abs(m.travel.y) + R + 0.15;
      const minX = m.x - Math.abs(m.travel.x) - R - 0.15;
      const maxX = m.x + m.w + Math.abs(m.travel.x) + R + 0.15;
      if (w.x > minX && w.x < maxX && w.y > minY && w.y < maxY) {
        // sai pelo lado mais próximo no eixo x (corredor horizontal)
        w.x = w.x - minX < maxX - w.x ? minX : maxX;
      }
    }
  }
  w.px = w.x;
  w.py = w.y;
}

/** Simula até parar/cair/sair. Retorna o resultado e a posição final. */
export function simulateShot(level: Level, from: Vec, t0: number, angle: number, power: number, params: GolfParams = GOLF) {
  const w = createWorld(level, from, t0, params);
  strike(w, angle, power);
  let guard = 0;
  while (w.status === 'moving' && guard++ < 1e5) step(w);
  return { status: w.status, x: w.x, y: w.y, t: w.t, events: w.events };
}

/**
 * Raio-guia: centro da bola até o primeiro toque em parede/obstáculo (mesma geometria da colisão) ou maxLen.
 * Quando o toque é numa parede fixa, devolve também a direção de saída da tabela, calculada com a MESMA regra
 * da colisão (componente normal × restituição, tangente × wallTangentKeep), para a prévia curta da tabela.
 */
export function aimRay(level: Level, from: Vec, angle: number, t: number, maxLen: number, params: GolfParams = GOLF) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxLen;
  let seg: { a: Vec; b: Vec; e: number } | null = null;
  const R = params.ballR;
  const capsule = (a: Vec, b: Vec, r: number, e: number | null) => {
    const t1 = rayCapsule(from, dx, dy, a, b, R + r);
    if (t1 < best) {
      best = t1;
      seg = e === null ? null : { a, b, e };
    }
  };
  for (const s of level.walls) capsule(s.a, s.b, s.r, s.restitution ?? params.wallRestitution);
  for (const b of level.bumpers) capsule(b.c, b.c, b.r, b.restitution ?? 0.62);
  for (const m of level.movers) for (const s of moverSegments(m, t)) capsule(s.a, s.b, s.r, null);
  const end = { x: from.x + dx * best, y: from.y + dy * best };
  let bounce: Vec | null = null;
  const hitSeg = seg as { a: Vec; b: Vec; e: number } | null;
  if (hitSeg && best < maxLen) {
    const ex = hitSeg.b.x - hitSeg.a.x;
    const ey = hitSeg.b.y - hitSeg.a.y;
    const l2 = ex * ex + ey * ey;
    const k = l2 ? Math.max(0, Math.min(1, ((end.x - hitSeg.a.x) * ex + (end.y - hitSeg.a.y) * ey) / l2)) : 0;
    let nx = end.x - (hitSeg.a.x + ex * k);
    let ny = end.y - (hitSeg.a.y + ey * k);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const vn = dx * nx + dy * ny;
    if (vn < 0) {
      const tx = dx - vn * nx;
      const ty = dy - vn * ny;
      const ox = tx * params.wallTangentKeep - vn * hitSeg.e * nx;
      const oy = ty * params.wallTangentKeep - vn * hitSeg.e * ny;
      const ol = Math.hypot(ox, oy) || 1;
      bounce = { x: ox / ol, y: oy / ol };
    }
  }
  return { end, length: best, hit: best < maxLen, bounce };
}

function rayCircle(o: Vec, dx: number, dy: number, c: Vec, r: number): number {
  const fx = o.x - c.x;
  const fy = o.y - c.y;
  const b = fx * dx + fy * dy;
  const cc = fx * fx + fy * fy - r * r;
  if (cc < 0) return b < 0 ? 0 : Infinity;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}

function rayCapsule(o: Vec, dx: number, dy: number, a: Vec, b: Vec, r: number): number {
  let best = Math.min(rayCircle(o, dx, dy, a, r), rayCircle(o, dx, dy, b, r));
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const L = Math.hypot(ex, ey);
  if (L > 0) {
    const ux = ex / L;
    const uy = ey / L;
    let nx = -uy;
    let ny = ux;
    const side = (o.x - a.x) * nx + (o.y - a.y) * ny;
    if (side < 0) {
      nx = -nx;
      ny = -ny;
    }
    const dn = dx * nx + dy * ny;
    const dist0 = Math.abs(side);
    if (dn < 0 && dist0 >= r) {
      const t = (dist0 - r) / -dn;
      const along = (o.x + dx * t - a.x) * ux + (o.y + dy * t - a.y) * uy;
      if (along >= 0 && along <= L) best = Math.min(best, t);
    }
  }
  return best;
}
