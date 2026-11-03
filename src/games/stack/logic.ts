/**
 * Empilha — física (planck.js, porta do Box2D, licença MIT) e regras, sem DOM.
 * Decisão (01/11): planck.js em vez de física própria. Empilhar corpos que giram e tombam exige um resolvedor de
 * contatos estável (impulsos sequenciais com "warm starting"); escrever isso do zero custaria dias e ficaria
 * instável. O planck só é baixado quando o Empilha abre (~55 KB comprimido), os outros jogos não pagam nada.
 * Unidades: "u" (≈ 10 cm), y para cima, plataforma com o topo em y = 0.
 */
import { Body, Circle, Polygon, Vec2, World } from 'planck';
import { PieceDef, pieceById, randomPiece } from './pieces';

export const PLATFORM = { w: 4.4, h: 0.5 };
/** Largura visível do mundo (u). */
export const VIEW_W = 11;
export const DT = 1 / 60;
/** Altura acima do topo da pilha onde a peça fica pendurada antes de soltar. */
export const HOLD_GAP = 1.6;
/** Abaixo disso (u) a peça caiu da plataforma. */
export const FALL_Y = -0.9;
/** Limite horizontal para posicionar a peça. */
export const AIM_LIMIT = 3.6;

export interface Snap {
  id: string;
  owner: 0 | 1;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
}

export interface Placed {
  id: string;
  owner: 0 | 1;
  body: Body;
}

const FIX = { density: 1, friction: 0.75, restitution: 0.02 };
/**
 * Amortecimento (01/11, pedido do Leon: "menos balanço"). Antes: giro 0,15 e linear 0. Medido em scripts/torre-feel.ts.
 * O linear é baixo para não virar "câmera lenta" na queda (0,1/s tira ~5% da velocidade em 0,6 s de queda).
 */
export const DAMPING = { angular: 1.5, linear: 0.1 };
/** Raio do arredondamento dos cantos na COLISÃO (u). O desenho já era arredondado; a forma física agora acompanha. */
export const CORNER = { r: 0.05 };
const MAX_VERTS = 12; // limite do planck (Settings.maxPolygonVertices)

/**
 * Arredonda os cantos de um polígono convexo: corta o canto mais "pontudo" em dois pontos a CORNER_R ao longo das
 * arestas, repetindo até 12 vértices. Cortar canto mantém o polígono convexo. Cantos já obtusos (>150°) ficam.
 */
export function roundCorners(pts: Array<[number, number]>, r = CORNER.r): Array<[number, number]> {
  let out = pts.map(([x, y]) => [x, y] as [number, number]);
  const angleAt = (i: number) => {
    const n = out.length;
    const [ax, ay] = out[(i - 1 + n) % n];
    const [bx, by] = out[i];
    const [cx, cy] = out[(i + 1) % n];
    const u = [ax - bx, ay - by];
    const v = [cx - bx, cy - by];
    return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])))));
  };
  const done = new Set<string>();
  while (out.length + 1 <= MAX_VERTS) {
    let bi = -1;
    let ba = (150 * Math.PI) / 180;
    for (let i = 0; i < out.length; i++) {
      const a = angleAt(i);
      if (a < ba && !done.has(out[i].join())) {
        ba = a;
        bi = i;
      }
    }
    if (bi < 0) break;
    const n = out.length;
    const a = out[(bi - 1 + n) % n];
    const b = out[bi];
    const c = out[(bi + 1) % n];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const d = Math.min(r, la * 0.3, lc * 0.3);
    const p1: [number, number] = [b[0] + ((a[0] - b[0]) * d) / la, b[1] + ((a[1] - b[1]) * d) / la];
    const p2: [number, number] = [b[0] + ((c[0] - b[0]) * d) / lc, b[1] + ((c[1] - b[1]) * d) / lc];
    done.add(p1.join());
    done.add(p2.join());
    out = [...out.slice(0, bi), p1, p2, ...out.slice(bi + 1)];
  }
  return out;
}
const roundedCache = new Map<string, Array<Array<[number, number]>>>();
function roundedParts(def: PieceDef) {
  const key = `${def.id}:${CORNER.r}`;
  let r = roundedCache.get(key);
  if (!r) {
    r = def.parts.map((p) => (p.type === 'poly' ? (CORNER.r > 0 ? roundCorners(p.pts) : p.pts) : []));
    roundedCache.set(key, r);
  }
  return r;
}

export class StackWorld {
  world: World;
  pieces: Placed[] = [];
  constructor() {
    this.world = new World({ gravity: new Vec2(0, -10) });
    const ground = this.world.createBody({ type: 'static', position: new Vec2(0, -PLATFORM.h / 2) });
    ground.createFixture(new Polygon([new Vec2(-PLATFORM.w / 2, -PLATFORM.h / 2), new Vec2(PLATFORM.w / 2, -PLATFORM.h / 2), new Vec2(PLATFORM.w / 2, PLATFORM.h / 2), new Vec2(-PLATFORM.w / 2, PLATFORM.h / 2)]), { friction: 0.9 });
  }

  add(id: string, x: number, y: number, a: number, owner: 0 | 1, v?: { vx: number; vy: number; w: number }): Placed {
    const def = pieceById(id);
    const body = this.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angle: a, angularDamping: DAMPING.angular, linearDamping: DAMPING.linear });
    const rp = roundedParts(def);
    for (const [i, p] of def.parts.entries()) {
      if (p.type === 'poly') body.createFixture(new Polygon(rp[i].map(([px, py]) => new Vec2(px, py))), FIX);
      else body.createFixture(new Circle(new Vec2(p.c[0], p.c[1]), p.r), FIX);
    }
    if (v) {
      body.setLinearVelocity(new Vec2(v.vx, v.vy));
      body.setAngularVelocity(v.w);
    }
    const pl = { id, owner, body };
    this.pieces.push(pl);
    return pl;
  }

  step(): void {
    this.world.step(DT, 8, 3);
  }

  fallen(): Placed[] {
    return this.pieces.filter((p) => p.body.getPosition().y < FALL_Y);
  }

  /** Maior velocidade (linear + giro) entre as peças. */
  motion(): number {
    let m = 0;
    for (const p of this.pieces) {
      const v = p.body.getLinearVelocity();
      m = Math.max(m, Math.hypot(v.x, v.y) + Math.abs(p.body.getAngularVelocity()) * 0.5);
    }
    return m;
  }

  /** Ponto mais alto da pilha (só peças em cima da plataforma). */
  topY(): number {
    let top = 0;
    for (const p of this.pieces) {
      if (p.body.getPosition().y < FALL_Y) continue;
      top = Math.max(top, pieceTop(pieceById(p.id), p.body));
    }
    return top;
  }

  snapshot(): Snap[] {
    return this.pieces.map((p) => {
      const pos = p.body.getPosition();
      const v = p.body.getLinearVelocity();
      return { id: p.id, owner: p.owner, x: pos.x, y: pos.y, a: p.body.getAngle(), vx: v.x, vy: v.y, w: p.body.getAngularVelocity() };
    });
  }

  static from(snap: Snap[]): StackWorld {
    const sw = new StackWorld();
    for (const s of snap) sw.add(s.id, s.x, s.y, s.a, s.owner, s);
    return sw;
  }
}

/** Ponto mais alto de uma peça (pelos vértices / círculos transformados). */
export function pieceTop(def: PieceDef, body: { getPosition(): { x: number; y: number }; getAngle(): number }): number {
  const pos = body.getPosition();
  const a = body.getAngle();
  return pieceTopAt(def, pos.y, a);
}

export function pieceTopAt(def: PieceDef, y: number, a: number): number {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let top = -Infinity;
  for (const p of def.parts) {
    if (p.type === 'poly') for (const [px, py] of p.pts) top = Math.max(top, y + px * s + py * c);
    else top = Math.max(top, y + p.c[0] * s + p.c[1] * c + p.r);
  }
  return top;
}

/** Ponto mais baixo da peça em relação ao seu centro (para pendurar sem atravessar a pilha). */
export function pieceBottomOffset(def: PieceDef, a: number): number {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let bot = Infinity;
  for (const p of def.parts) {
    if (p.type === 'poly') for (const [px, py] of p.pts) bot = Math.min(bot, px * s + py * c);
    else bot = Math.min(bot, p.c[0] * s + p.c[1] * c - p.r);
  }
  return bot;
}

/**
 * Prévia: altura (centro) onde a peça, descendo reta a partir de holdY, ENCOSTA primeiro em algo.
 * Raios verticais saindo de pontos do contorno da peça (a cada ~0,1 u), na mesma física (planck).
 * É só o primeiro contato: não diz se a pilha vai ficar de pé depois (pode escorregar ou tombar).
 */
export function landingY(sw: StackWorld, def: PieceDef, x: number, holdY: number, a: number): number {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pts: [number, number][] = [];
  for (const p of def.parts) {
    if (p.type === 'poly') {
      for (let i = 0; i < p.pts.length; i++) {
        const [x0, y0] = p.pts[i];
        const [x1, y1] = p.pts[(i + 1) % p.pts.length];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.1));
        for (let k = 0; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
      }
    } else {
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2;
        pts.push([p.c[0] + Math.cos(t) * p.r, p.c[1] + Math.sin(t) * p.r]);
      }
    }
  }
  let minD = Infinity;
  for (const [px, py] of pts) {
    const wx = x + px * c - py * s;
    const wy = holdY + px * s + py * c;
    const p1 = new Vec2(wx, wy);
    const p2 = new Vec2(wx, wy - 40);
    sw.world.rayCast(p1, p2, (_f, point, _n, fraction) => {
      minD = Math.min(minD, wy - point.y);
      return fraction;
    });
  }
  return minD === Infinity ? -Infinity : holdY - minD;
}

export type Phase = 'aim' | 'settle' | 'over';

/**
 * Partida: jogadores se alternam colocando uma peça na pilha compartilhada. Se alguma peça cair da plataforma
 * depois da jogada, quem acabou de jogar perde. Solo: empilhar o máximo possível.
 */
export class StackMatch {
  sw = new StackWorld();
  current: 0 | 1 = 0;
  phase: Phase = 'aim';
  loser: 0 | 1 | null = null;
  /** Peças que ficaram (jogadas completas). */
  placed = 0;
  piece: string;
  nextPiece: string;
  settleT = 0;
  quietT = 0;
  /** Peça que caiu (para o efeito). */
  fallenAt: { x: number; y: number } | null = null;
  constructor(
    public players: 1 | 2,
    private rng: () => number = Math.random,
  ) {
    this.piece = randomPiece(rng);
    this.nextPiece = randomPiece(rng);
  }

  /** Altura (centro) onde a peça atual fica pendurada para o ângulo dado. */
  holdY(angle: number): number {
    return this.sw.topY() + HOLD_GAP - pieceBottomOffset(pieceById(this.piece), angle);
  }

  drop(x: number, angle: number): boolean {
    if (this.phase !== 'aim') return false;
    const cx = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, x));
    this.sw.add(this.piece, cx, this.holdY(angle), angle, this.current);
    this.phase = 'settle';
    this.settleT = 0;
    this.quietT = 0;
    return true;
  }

  /** Avança um passo fixo de física. Retorna 'fell' | 'next' | null quando a jogada termina. */
  tick(): 'fell' | 'next' | null {
    if (this.phase !== 'settle') return null;
    this.sw.step();
    this.settleT += DT;
    const f = this.sw.fallen();
    if (f.length) {
      const p = f[0].body.getPosition();
      this.fallenAt = { x: p.x, y: p.y };
      this.loser = this.current;
      this.phase = 'over';
      return 'fell';
    }
    this.quietT = this.sw.motion() < 0.08 ? this.quietT + DT : 0;
    // A deadline alone cannot hand an unstable tower to the next player.
    if (this.quietT > 0.45 && this.settleT > 0.6) {
      this.placed++;
      this.piece = this.nextPiece;
      this.nextPiece = randomPiece(this.rng);
      if (this.players === 2) this.current = (1 - this.current) as 0 | 1;
      this.phase = 'aim';
      return 'next';
    }
    return null;
  }
}

/** Simula uma jogada (sem alterar a partida): resultado e instabilidade. Usado pela IA e pelos testes. */
export function simulateDrop(
  snap: Snap[],
  piece: string,
  x: number,
  angle: number,
  holdY: number,
  maxSecs = 3.5,
): { fell: boolean; fellAt: number; disturb: number; top: number; tilt: number } {
  const sw = StackWorld.from(snap);
  const pl = sw.add(piece, x, holdY, angle, 0);
  const start = sw.pieces.map((p) => ({ x: p.body.getPosition().x, y: p.body.getPosition().y, a: p.body.getAngle() }));
  let quiet = 0;
  let t = 0;
  for (; t < maxSecs; t += DT) {
    sw.step();
    if (sw.fallen().length) return { fell: true, fellAt: t, disturb: 99, top: 0, tilt: 0 };
    quiet = sw.motion() < 0.08 ? quiet + DT : 0;
    if (quiet > 0.4 && t > 0.6) break;
  }
  let disturb = 0;
  sw.pieces.forEach((p, i) => {
    if (p === pl) return;
    const q = p.body.getPosition();
    disturb += Math.hypot(q.x - start[i].x, q.y - start[i].y) + Math.abs(p.body.getAngle() - start[i].a) * 0.3;
  });
  // ainda mexendo no fim = instável
  disturb += sw.motion() * 2;
  return { fell: false, fellAt: maxSecs, disturb, top: sw.topY(), tilt: Math.abs(Math.sin(pl.body.getAngle() * 2)) };
}
