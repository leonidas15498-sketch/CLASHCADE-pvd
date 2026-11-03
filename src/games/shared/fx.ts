import { isUnlocked } from '../../services/economy';
/**
 * Efeitos cosméticos compartilhados (sinuca, minigolfe e próximos jogos):
 *  - Rastro da bola em movimento (item à parte, escolhido pelo jogador).
 *  - Explosão ao encaçapar / cair no buraco (vem com o tema da mesa ou campo).
 * Tudo desenhado em Canvas 2D pelo próprio jogo (sem imagens, sem filtro CSS).
 * Só visual: nada aqui toca física, regras ou IA.
 *
 * Coordenadas: as do mundo de cada jogo. `u` = raio da bola nessa unidade
 * (sinuca ≈ 0,0286 m; golfe = 0,7 u), para o mesmo efeito ter o mesmo tamanho relativo.
 */

export interface FxPoint {
  x: number;
  y: number;
}

// ------------------------------------------------- preferência global
/** Liga/desliga as explosões (todos os jogos). Rastro tem a opção própria "Sem rastro". */
const FX_KEY = 'jogaco.fx.v1';
let burstsOn: boolean | null = null;
export function burstsEnabled(): boolean {
  if (burstsOn === null) {
    try {
      const v = JSON.parse(localStorage.getItem(FX_KEY) ?? '{}') as { bursts?: unknown };
      burstsOn = v.bursts !== false;
    } catch {
      burstsOn = true;
    }
  }
  return burstsOn;
}
export function setBurstsEnabled(on: boolean) {
  burstsOn = on;
  try {
    localStorage.setItem(FX_KEY, JSON.stringify({ bursts: on }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Interruptor pronto para a aba "Rastro" de cada jogo. */
export function mountBurstToggle(host: HTMLElement, what: string) {
  host.innerHTML = `<label class="fx-toggle"><input type="checkbox" ${burstsEnabled() ? 'checked' : ''}/> <span>Efeito quando ${what}</span></label>
    <small class="fx-toggle-note">Desligado = jogo "cru", sem explosões. Para tirar o rastro, escolha "Sem rastro".</small>`;
  host.querySelector('input')!.addEventListener('change', (e) => setBurstsEnabled((e.target as HTMLInputElement).checked));
}

// ---------------------------------------------------------------- rastros

export type TrailId = 'nenhum' | 'sombra' | 'chama' | 'neon' | 'estrelas' | 'fumaca' | 'morcegos';

export interface TrailDef {
  id: TrailId;
  name: string;
  tier: 'free' | 'premium';
  description: string;
}

export const TRAILS: TrailDef[] = [
  { id: 'nenhum', name: 'Sem rastro', tier: 'free', description: 'Só a bola, sem efeito.' },
  { id: 'sombra', name: 'Sombra', tier: 'free', description: 'Faixa suave na cor do jogador.' },
  { id: 'chama', name: 'Chama', tier: 'premium', description: 'Fogo do vermelho ao amarelo.' },
  { id: 'neon', name: 'Neon', tier: 'premium', description: 'Linha ciano brilhante.' },
  { id: 'estrelas', name: 'Estrelas', tier: 'premium', description: 'Estrelinhas douradas girando.' },
  { id: 'fumaca', name: 'Fumaça roxa', tier: 'premium', description: 'Nuvem roxa que se espalha.' },
  { id: 'morcegos', name: 'Morcegos', tier: 'premium', description: 'Revoada de morcegos (Halloween).' },
];

export const trailById = (id: string | undefined): TrailDef => TRAILS.find((t) => t.id === id) ?? TRAILS[0];
export const isTrailAvailable = (t: TrailDef) => isUnlocked(`fx.trail.${t.id}`);
/** Rastro que pode ser usado de fato (premium bloqueado cai para o padrão informado). */
export const usableTrail = (id: string | undefined, fallback: TrailId): TrailId => {
  const t = TRAILS.find((x) => x.id === id);
  return t && isTrailAvailable(t) ? t.id : fallback;
};

/** Histórico curto de posições de uma bola em movimento. */
/**
 * Rastro por TEMPO e DISTÂNCIA (não por quadro): uma amostra só entra se a bola andou `minDist`, e cada amostra vive
 * `maxAge` segundos. Assim o rastro tem o mesmo comprimento em 30, 60 ou 120 FPS e não acumula pontos com a bola lenta.
 * `t` = relógio em segundos (o mesmo nas chamadas de push e prune).
 */
export class TrailBuffer {
  pts: FxPoint[] = [];
  private ts: number[] = [];
  constructor(
    public maxAge = 0.35,
    public minDist = 0,
    private cap = 64,
  ) {}
  push(x: number, y: number, t: number) {
    const l = this.pts[this.pts.length - 1];
    if (!l || Math.hypot(x - l.x, y - l.y) >= this.minDist) {
      if (!(l && l.x === x && l.y === y)) {
        this.pts.push({ x, y });
        this.ts.push(t);
      }
    }
    this.prune(t);
  }
  /** Remove as amostras mais velhas que maxAge (chamar todo quadro; com a bola parada o rastro some sozinho). */
  prune(t: number) {
    let k = 0;
    while (k < this.ts.length && t - this.ts[k] > this.maxAge) k++;
    if (this.pts.length - k > this.cap) k = this.pts.length - this.cap;
    if (k > 0) {
      this.pts.splice(0, k);
      this.ts.splice(0, k);
    }
  }
  clear() {
    this.pts = [];
    this.ts = [];
  }
}

const TAU = Math.PI * 2;

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, points = 4) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rr = i % 2 === 0 ? r : r * 0.38;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function bat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const f = 0.55 + 0.45 * flap; // abertura das asas
  ctx.beginPath();
  ctx.moveTo(0, -0.18 * s);
  ctx.quadraticCurveTo(0.45 * s, -0.55 * s * f, 1.0 * s, -0.25 * s * f);
  ctx.quadraticCurveTo(0.8 * s, -0.05 * s, 0.75 * s, 0.12 * s);
  ctx.quadraticCurveTo(0.55 * s, 0.0, 0.42 * s, 0.18 * s);
  ctx.quadraticCurveTo(0.25 * s, 0.05, 0, 0.3 * s);
  ctx.quadraticCurveTo(-0.25 * s, 0.05, -0.42 * s, 0.18 * s);
  ctx.quadraticCurveTo(-0.55 * s, 0.0, -0.75 * s, 0.12 * s);
  ctx.quadraticCurveTo(-0.8 * s, -0.05 * s, -1.0 * s, -0.25 * s * f);
  ctx.quadraticCurveTo(-0.45 * s, -0.55 * s * f, 0, -0.18 * s);
  ctx.closePath();
  ctx.restore();
}

/**
 * Desenha o rastro (pontos do mais antigo ao mais novo).
 * `color` = cor do jogador (usada pela "Sombra"); `t` = tempo em segundos (animação).
 */
export function drawTrail(ctx: CanvasRenderingContext2D, id: TrailId, pts: FxPoint[], u: number, color: string, t: number) {
  const n = pts.length;
  if (id === 'nenhum' || n < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const seg = (i: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  switch (id) {
    case 'sombra':
      ctx.strokeStyle = color;
      for (let i = 1; i < n; i++) {
        const k = i / n;
        ctx.globalAlpha = 0.35 * k;
        ctx.lineWidth = u * 1.3 * k;
        seg(i);
      }
      break;
    case 'chama':
      // corpo opaco (sem 'lighter', que deixava a chama verde-limão no feltro verde); só o miolo brilha
      for (let i = 1; i < n; i++) {
        const k = i / n;
        const flick = 0.85 + 0.15 * Math.sin(t * 40 + i * 1.7);
        // vermelho (cauda) → laranja → amarelo (perto da bola)
        const g = Math.round(50 + 160 * k);
        const b = Math.round(10 + 40 * k * k);
        ctx.strokeStyle = `rgb(255,${g},${b})`;
        ctx.globalAlpha = 0.25 + 0.55 * k;
        ctx.lineWidth = u * 2.0 * k * flick;
        seg(i);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#fff1b0';
      for (let i = Math.max(1, Math.floor(n * 0.6)); i < n; i++) {
        ctx.lineWidth = u * 0.55 * (i / n);
        seg(i);
      }
      break;
    case 'neon':
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, a, c] of [
        [2.6, 0.16, '#2de2ff'],
        [1.3, 0.35, '#2de2ff'],
        [0.45, 0.95, '#e8fdff'],
      ] as const) {
        ctx.strokeStyle = c;
        for (let i = 1; i < n; i++) {
          const k = i / n;
          ctx.globalAlpha = a * k;
          ctx.lineWidth = u * w * (0.35 + 0.65 * k);
          seg(i);
        }
      }
      break;
    case 'fumaca':
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;
        const age = 1 - k;
        const wob = Math.sin(t * 3 + i) * u * 0.25 * age;
        ctx.globalAlpha = 0.38 * k + 0.08;
        ctx.fillStyle = i % 2 ? '#d2aaff' : '#b27aff';
        ctx.beginPath();
        ctx.arc(pts[i].x + wob, pts[i].y - wob, u * (0.55 + 1.25 * age), 0, TAU);
        ctx.fill();
      }
      break;
    case 'estrelas':
      ctx.globalCompositeOperation = 'lighter';
      for (let i = n - 1; i >= 0; i -= 2) {
        const k = (i + 1) / n;
        ctx.globalAlpha = 0.9 * k;
        ctx.fillStyle = i % 4 === 1 ? '#ffffff' : '#ffd54a';
        star(ctx, pts[i].x, pts[i].y, u * (0.35 + 0.65 * k), t * 4 + i * 0.9);
        ctx.fill();
      }
      break;
    case 'morcegos':
      for (let i = n - 1; i >= 0; i -= 3) {
        const k = (i + 1) / n;
        const p = pts[i];
        const q = pts[Math.max(0, i - 1)];
        const ang = Math.atan2(p.y - q.y, p.x - q.x) + Math.PI / 2;
        const off = Math.sin(i * 2.3) * u * 0.9 * (1 - k);
        ctx.globalAlpha = 0.35 + 0.65 * k;
        bat(ctx, p.x + Math.cos(ang) * off, p.y + Math.sin(ang) * off, u * (1.0 + 0.7 * k), Math.abs(Math.sin(t * 14 + i)), ang + Math.PI);
        ctx.fillStyle = '#140818';
        ctx.fill();
        ctx.strokeStyle = '#ffae4a';
        ctx.lineWidth = u * 0.14;
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

// --------------------------------------------------------------- explosões

export type BurstStyle = 'simples' | 'abobora' | 'galaxia' | 'bolhas' | 'folhas' | 'faiscas' | 'faiscas-vermelhas' | 'confete' | 'contato';
export type ParticleKind = 'dot' | 'spark' | 'star' | 'pumpkin' | 'skull' | 'bubble' | 'leaf' | 'confetti' | 'ring';

export interface FxParticle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  /** Tamanho final (unidades do mundo). */
  size: number;
  color: string;
  age: number;
  life: number;
}

/** Limite de partículas vivas (celular fraco). */
export const MAX_PARTICLES = 220;
/** Arrasto (1/s): as partículas espalham e freiam perto do ponto de origem. */
const DRAG = 3.2;

const prefersReducedMotion = () => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

type Recipe = Array<{ kind: ParticleKind; n: number; colors: string[]; speed: [number, number]; size: [number, number]; life: [number, number]; spin?: number }>;

/** Receitas em múltiplos de `u` (raio da bola). */
export const BURSTS: Record<BurstStyle, Recipe> = {
  simples: [
    { kind: 'dot', n: 10, colors: ['#ffffff', '#fff3c4'], speed: [3, 7], size: [0.18, 0.3], life: [0.35, 0.55] },
    { kind: 'ring', n: 1, colors: ['rgba(255,255,255,0.7)'], speed: [0, 0], size: [2.6, 2.6], life: [0.35, 0.35] },
  ],
  abobora: [
    { kind: 'ring', n: 1, colors: ['#ff9f32'], speed: [0, 0], size: [4, 4], life: [0.45, 0.45] },
    { kind: 'pumpkin', n: 5, colors: ['#ff8a1f'], speed: [7, 12], size: [1.35, 1.7], life: [0.8, 1.0], spin: 3 },
    { kind: 'skull', n: 3, colors: ['#f4efe6'], speed: [6, 11], size: [1.1, 1.4], life: [0.75, 0.95], spin: 2.5 },
    { kind: 'spark', n: 14, colors: ['#ff9f32', '#ffd29a', '#b45cff'], speed: [6, 12], size: [0.3, 0.5], life: [0.35, 0.6] },
  ],
  galaxia: [
    { kind: 'ring', n: 1, colors: ['#c18bff'], speed: [0, 0], size: [3.2, 3.2], life: [0.5, 0.5] },
    { kind: 'star', n: 12, colors: ['#ffffff', '#e0c4ff', '#9bd1ff'], speed: [4, 9], size: [0.6, 0.95], life: [0.55, 0.85], spin: 5 },
    { kind: 'dot', n: 14, colors: ['#a46ae8', '#7542c0', '#ffffff'], speed: [2, 6], size: [0.12, 0.22], life: [0.5, 0.8] },
  ],
  bolhas: [
    { kind: 'bubble', n: 12, colors: ['#bff0ff'], speed: [2, 5.5], size: [0.25, 0.55], life: [0.6, 0.9] },
    { kind: 'ring', n: 1, colors: ['#bff0ff'], speed: [0, 0], size: [3, 3], life: [0.45, 0.45] },
  ],
  folhas: [
    { kind: 'leaf', n: 12, colors: ['#5fbf4a', '#3f9140', '#a6d96a', '#d8f0c4'], speed: [3.5, 8], size: [0.8, 1.15], life: [0.7, 1.0], spin: 6 },
  ],
  faiscas: [
    { kind: 'ring', n: 1, colors: ['#f0cd6a'], speed: [0, 0], size: [2.8, 2.8], life: [0.35, 0.35] },
    { kind: 'spark', n: 22, colors: ['#fff0b8', '#f0cd6a', '#c9962f'], speed: [7, 14], size: [0.3, 0.55], life: [0.3, 0.55] },
  ],
  'faiscas-vermelhas': [
    { kind: 'ring', n: 1, colors: ['#ff5a67'], speed: [0, 0], size: [2.8, 2.8], life: [0.35, 0.35] },
    { kind: 'spark', n: 22, colors: ['#ff8a96', '#ff5a67', '#ffffff'], speed: [7, 14], size: [0.3, 0.55], life: [0.3, 0.55] },
  ],
  // poeirinha de impacto (Torre de Bichinhos, 01/11): poucas partículas pequenas e rápidas no ponto de contato
  contato: [
    { kind: 'dot', n: 8, colors: ['#ffffff', '#ffe7a6', '#ffc24a'], speed: [3, 7], size: [0.16, 0.28], life: [0.22, 0.38] },
    { kind: 'ring', n: 1, colors: ['rgba(255,231,166,0.75)'], speed: [0, 0], size: [2.2, 2.2], life: [0.25, 0.25] },
  ],
  confete: [
    { kind: 'confetti', n: 26, colors: ['#ffc93c', '#ff6b4a', '#3d8bff', '#7bd389', '#ffffff'], speed: [4, 10], size: [0.6, 0.9], life: [0.8, 1.1], spin: 9 },
  ],
};

export class ParticleSystem {
  items: FxParticle[] = [];
  /** Fração das partículas criadas (reduzida se o aparelho pede menos animação). */
  density: number;
  /** Ignora a preferência (testes). */
  force = false;
  constructor(private rng: () => number = Math.random, density?: number) {
    this.density = density ?? (prefersReducedMotion() ? 0.35 : 1);
  }

  burst(style: BurstStyle, x: number, y: number, u: number) {
    if (!this.force && !burstsEnabled()) return;
    const r = this.rng;
    const lerp = (a: [number, number]) => a[0] + (a[1] - a[0]) * r();
    for (const part of BURSTS[style]) {
      const n = part.kind === 'ring' ? part.n : Math.max(1, Math.round(part.n * this.density));
      for (let i = 0; i < n; i++) {
        if (this.items.length >= MAX_PARTICLES) this.items.shift();
        const a = r() * TAU;
        const sp = lerp(part.speed) * u;
        this.items.push({
          kind: part.kind,
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          rot: r() * TAU,
          vr: (r() - 0.5) * 2 * (part.spin ?? 2),
          size: lerp(part.size) * u,
          color: part.colors[i % part.colors.length],
          age: 0,
          life: lerp(part.life),
        });
      }
    }
  }

  update(dt: number) {
    const f = Math.exp(-DRAG * dt);
    for (const p of this.items) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= f;
      p.vy *= f;
      p.rot += p.vr * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  clear() {
    this.items = [];
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.items) drawParticle(ctx, p);
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: FxParticle) {
  const k = p.age / p.life;
  const pop = Math.min(1, p.age / 0.08); // surge rápido
  const fade = k > 0.7 ? (1 - k) / 0.3 : 1; // some no fim
  const s = p.size * pop * (p.kind === 'ring' ? 0.25 + 0.75 * k : 1);
  if (s <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  switch (p.kind) {
    case 'dot':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.fill();
      break;
    case 'spark': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.45;
      const ang = Math.atan2(p.vy, p.vx) - p.rot;
      const len = s * (1 + Math.hypot(p.vx, p.vy) / (p.size * 6 + 1e-9));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(ang) * len, -Math.sin(ang) * len);
      ctx.stroke();
      break;
    }
    case 'star':
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      star(ctx, 0, 0, s, 0);
      ctx.fill();
      break;
    case 'ring':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.12 * (1 - k);
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.stroke();
      break;
    case 'bubble':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, TAU);
      ctx.fill();
      break;
    case 'leaf':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(0, -s * 0.75, s, 0);
      ctx.quadraticCurveTo(0, s * 0.75, -s, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s * 0.8, 0);
      ctx.stroke();
      break;
    case 'confetti':
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 4, s, (s / 2) * Math.abs(Math.cos(p.rot * 2)) + s * 0.08);
      break;
    case 'pumpkin':
      drawPumpkin(ctx, s);
      break;
    case 'skull':
      drawSkull(ctx, s);
      break;
  }
  ctx.restore();
}

/** Abóbora de Halloween vista de frente, raio ≈ s. */
function drawPumpkin(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#c95a0c';
  for (const dx of [-0.42, 0.42]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, 0.05 * s, 0.55 * s, 0.78 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.ellipse(0, 0.05 * s, 0.6 * s, 0.82 * s, 0, 0, TAU);
  ctx.fill();
  // cabinho
  ctx.fillStyle = '#4b6b1f';
  ctx.fillRect(-0.1 * s, -0.98 * s, 0.2 * s, 0.3 * s);
  // rosto aceso
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.moveTo(-0.5 * s, -0.15 * s);
  ctx.lineTo(-0.2 * s, -0.15 * s);
  ctx.lineTo(-0.35 * s, -0.42 * s);
  ctx.closePath();
  ctx.moveTo(0.5 * s, -0.15 * s);
  ctx.lineTo(0.2 * s, -0.15 * s);
  ctx.lineTo(0.35 * s, -0.42 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.55 * s, 0.22 * s);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-0.55 * s + (i * 1.1 * s) / 6, (i % 2 ? 0.34 : 0.22) * s);
  ctx.lineTo(0.4 * s, 0.55 * s);
  ctx.lineTo(-0.4 * s, 0.55 * s);
  ctx.closePath();
  ctx.fill();
}

/** Caveirinha, raio ≈ s. */
function drawSkull(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(0, -0.15 * s, 0.75 * s, 0, TAU);
  ctx.fill();
  ctx.fillRect(-0.42 * s, 0.3 * s, 0.84 * s, 0.45 * s);
  ctx.fillStyle = '#2a1229';
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(dx * s, -0.1 * s, 0.21 * s, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0.12 * s);
  ctx.lineTo(-0.09 * s, 0.3 * s);
  ctx.lineTo(0.09 * s, 0.3 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-0.3 * s, 0.5 * s, 0.6 * s, 0.05 * s);
  for (const dx of [-0.16, 0, 0.16]) ctx.fillRect(dx * s - 0.02 * s, 0.4 * s, 0.04 * s, 0.35 * s);
  // olhos roxos acesos
  ctx.fillStyle = '#c77dff';
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(dx * s, -0.1 * s, 0.08 * s, 0, TAU);
    ctx.fill();
  }
}
