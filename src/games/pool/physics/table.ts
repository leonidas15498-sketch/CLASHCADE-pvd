import { Vec, v } from './vec';

/**
 * Unidades: metros e segundos. Origem no canto superior esquerdo do campo interno
 * (linha do nariz das tabelas). x cresce para a direita, y para baixo.
 * Mesa de 9 pés: campo interno 2,54 m x 1,27 m (2:1). Bola: 57,15 mm.
 */
export interface PhysicsParams {
  ballRadius: number;
  /** Desaceleração constante de rolamento (m/s²). */
  rollDecel: number;
  /** Arrasto linear (1/s) — faz a parada final ser suave e previsível. */
  linearDrag: number;
  /** Velocidade abaixo da qual a bola é considerada em repouso (m/s). */
  restSpeed: number;
  ballRestitution: number;
  cushionRestitution: number;
  /** Atrito de deslizamento bola-feltro (μ). Atua até a bola passar a rolar sem escorregar. */
  slideFriction: number;
  /** Desaceleração angular do giro em torno do eixo vertical (efeito lateral), rad/s². */
  spinDecel: number;
  /** Atrito bola-tabela (μ) — transfere efeito lateral na tabela. */
  cushionFriction: number;
  /** Fração horizontal do giro de rolamento que sobra após bater na tabela (0..1). */
  cushionRollKeep: number;
  /** Distância máxima do centro em que o taco pode bater (fração do raio). */
  maxTipOffset: number;
  /** Gravidade (m/s²). */
  gravity: number;
  /** Velocidade máxima da branca ao sair do taco (m/s), em 100% de força. */
  maxCueSpeed: number;
  /** Expoente da curva força → velocidade (1 = linear). */
  powerCurve: number;
  /** Passo fixo da simulação (s). */
  dt: number;
  /** Deslocamento máximo por subpasso, em frações do raio (anti-atravessamento). */
  maxMovePerSubstep: number;
  maxSubsteps: number;
}

export const DEFAULT_PARAMS: PhysicsParams = {
  ballRadius: 0.028575,
  rollDecel: 0.12,
  linearDrag: 0.02,
  restSpeed: 0.006,
  ballRestitution: 0.95,
  cushionRestitution: 0.82,
  slideFriction: 0.2,
  spinDecel: 22,
  cushionFriction: 0.2,
  cushionRollKeep: 0.5,
  maxTipOffset: 0.5,
  gravity: 9.81,
  maxCueSpeed: 9,
  powerCurve: 1.5,
  dt: 1 / 120,
  maxMovePerSubstep: 0.25,
  maxSubsteps: 24,
};

export interface Segment {
  a: Vec;
  b: Vec;
  kind: 'cushion' | 'jaw';
}

export interface Pocket {
  id: number;
  /** Centro da zona de captura (fica além da linha da boca, fora do campo). */
  center: Vec;
  captureRadius: number;
  /** Ponto de mira: centro da boca, ligeiramente para dentro. */
  aim: Vec;
  /** Pontos das quinas (jaws) que formam a boca. */
  mouthA: Vec;
  mouthB: Vec;
  /** Direção do eixo da caçapa (aponta para fora da mesa). */
  axis: Vec;
  kind: 'corner' | 'side';
}

export interface TableGeometry {
  length: number;
  width: number;
  segments: Segment[];
  pockets: Pocket[];
  /** Linha de cabeceira (head string) — x máximo da "cozinha". */
  headStringX: number;
  footSpot: Vec;
  headSpot: Vec;
}

export function buildTable(R = DEFAULT_PARAMS.ballRadius): TableGeometry {
  const L = 2.54;
  const W = 1.27;
  const c = 0.0815; // distância da quina de canto ao vértice (boca de canto ≈ c·√2 ≈ 115 mm)
  const s = 0.066; // meia-largura da boca lateral (≈ 132 mm)
  const jaw = 0.07; // profundidade da garganta
  const d = Math.SQRT1_2;
  const segs: Segment[] = [];
  const cush = (a: Vec, b: Vec) => segs.push({ a, b, kind: 'cushion' });
  const jw = (a: Vec, b: Vec) => segs.push({ a, b, kind: 'jaw' });

  // Tabelas longas (topo e base), interrompidas pelas caçapas de canto e laterais.
  cush(v(c, 0), v(L / 2 - s, 0));
  cush(v(L / 2 + s, 0), v(L - c, 0));
  cush(v(c, W), v(L / 2 - s, W));
  cush(v(L / 2 + s, W), v(L - c, W));
  // Tabelas curtas (cabeceira e pé).
  cush(v(0, c), v(0, W - c));
  cush(v(L, c), v(L, W - c));

  // Gargantas laterais: paredes paralelas ao eixo (perpendiculares à tabela).
  jw(v(L / 2 - s, 0), v(L / 2 - s, -jaw));
  jw(v(L / 2 + s, 0), v(L / 2 + s, -jaw));
  jw(v(L / 2 - s, W), v(L / 2 - s, W + jaw));
  jw(v(L / 2 + s, W), v(L / 2 + s, W + jaw));

  // Gargantas de canto: paredes paralelas à diagonal.
  const corners: Array<[Vec, Vec, Vec]> = [
    // [quina na tabela longa, quina na tabela curta, eixo para fora]
    [v(c, 0), v(0, c), v(-d, -d)],
    [v(L - c, 0), v(L, c), v(d, -d)],
    [v(c, W), v(0, W - c), v(-d, d)],
    [v(L - c, W), v(L, W - c), v(d, d)],
  ];
  for (const [p1, p2, ax] of corners) {
    jw(p1, v(p1.x + ax.x * jaw, p1.y + ax.y * jaw));
    jw(p2, v(p2.x + ax.x * jaw, p2.y + ax.y * jaw));
  }

  const pockets: Pocket[] = [];
  const corner = (id: number, p1: Vec, p2: Vec, ax: Vec) => {
    const mid = v((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    pockets.push({
      id,
      kind: 'corner',
      center: v(mid.x + ax.x * 0.035, mid.y + ax.y * 0.035),
      captureRadius: 0.06, // = raio do buraco desenhado (centro da bola sobre o buraco → cai)
      aim: v(mid.x - ax.x * 0.01, mid.y - ax.y * 0.01),
      mouthA: p1,
      mouthB: p2,
      axis: ax,
    });
  };
  const side = (id: number, y: number, dir: number) => {
    pockets.push({
      id,
      kind: 'side',
      center: v(L / 2, y + dir * 0.035),
      captureRadius: 0.055, // = raio do buraco desenhado
      aim: v(L / 2, y - dir * 0.005),
      mouthA: v(L / 2 - s, y),
      mouthB: v(L / 2 + s, y),
      axis: v(0, dir),
      // a ordem dos ids segue: 0 sup-esq, 1 sup-meio, 2 sup-dir, 3 inf-esq, 4 inf-meio, 5 inf-dir
    });
  };
  corner(0, corners[0][0], corners[0][1], corners[0][2]);
  side(1, 0, -1);
  corner(2, corners[1][0], corners[1][1], corners[1][2]);
  corner(3, corners[2][0], corners[2][1], corners[2][2]);
  side(4, W, 1);
  corner(5, corners[3][0], corners[3][1], corners[3][2]);
  pockets.sort((a, b) => a.id - b.id);

  void R;
  return {
    length: L,
    width: W,
    segments: segs,
    pockets,
    headStringX: L / 4,
    headSpot: v(L / 4, W / 2),
    footSpot: v((3 * L) / 4, W / 2),
  };
}

export const TABLE = buildTable();
