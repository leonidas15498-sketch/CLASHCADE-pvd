/**
 * Minigolfe — tipos do mundo físico. Unidades de jogo "u" (1 u ≈ 3 cm na escala visual);
 * tempo em segundos. Nada aqui depende de DOM, canvas ou React.
 */
export interface Vec {
  x: number;
  y: number;
}

/** Parede: segmento com espessura (cápsula de raio `r`). r = 0 → linha fina (borda do campo). */
export interface Wall {
  a: Vec;
  b: Vec;
  r: number;
  restitution?: number;
}

export interface Bumper {
  c: Vec;
  r: number;
  restitution?: number;
}

export type Mover =
  | {
      kind: 'rotor';
      center: Vec;
      arms: number;
      length: number;
      /** Meia-espessura da pá. */
      r: number;
      /** rad/s (positivo = horário na tela, pois y cresce para baixo). */
      speed: number;
      phase: number;
    }
  | {
      kind: 'slider';
      /** Retângulo do bloco na posição central (cantos). */
      x: number;
      y: number;
      w: number;
      h: number;
      /** Deslocamento máximo a partir do centro (vetor) e período (s). */
      travel: Vec;
      period: number;
      phase: number;
    };

export type Zone =
  | { kind: 'slope'; poly: Vec[]; accel: Vec }
  | { kind: 'sand'; poly: Vec[] }
  | { kind: 'water'; poly: Vec[] };

export interface Level {
  id: number;
  name: string;
  par: number;
  /** Área total a enquadrar na câmera. */
  bounds: { x: number; y: number; w: number; h: number };
  /** Gramado (polígono). Sair dele = fora de campo. */
  green: Vec[];
  /** Índices das arestas do gramado SEM parede (dão para a água/areia). */
  openEdges?: number[];
  walls: Wall[];
  /** Blocos maciços (desenhados preenchidos; as bordas já estão em `walls`). */
  blocks: Vec[][];
  bumpers: Bumper[];
  movers: Mover[];
  zones: Zone[];
  tee: Vec;
  hole: Vec;
  /** Caminho de referência (do tee ao buraco) usado pelos testes de solucionabilidade. */
  route: Vec[];
  tip: string;
}

export interface GolfParams {
  ballR: number;
  holeR: number;
  dt: number;
  maxSpeed: number;
  rollDecel: number;
  drag: number;
  sandDecel: number;
  restSpeed: number;
  wallRestitution: number;
  wallTangentKeep: number;
  /** Velocidade máxima para cair no buraco passando pelo centro (u/s). */
  holeCaptureSpeed: number;
  maxMovePerSubstep: number;
  maxSubsteps: number;
  maxShotSeconds: number;
}

export const GOLF: GolfParams = {
  ballR: 0.7,
  holeR: 1.25,
  dt: 1 / 120,
  // Calibração 01/11: desaceleração quase constante (resistência de rolamento do carpete), sem freio
  // proporcional à velocidade. Força → distância linear: 100% ≈ 61 u, 50% ≈ metade.
  maxSpeed: 27,
  rollDecel: 6,
  drag: 0,
  sandDecel: 30,
  restSpeed: 0.12,
  wallRestitution: 0.7,
  wallTangentKeep: 0.93,
  holeCaptureSpeed: 13.5,
  maxMovePerSubstep: 0.3,
  maxSubsteps: 24,
  maxShotSeconds: 25,
};
