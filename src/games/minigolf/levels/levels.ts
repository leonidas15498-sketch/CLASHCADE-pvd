import type { Bumper, Level, Mover, Vec, Wall, Zone } from '../physics/types';

const v = (x: number, y: number): Vec => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Vec[] => [v(x, y), v(x + w, y), v(x + w, y + h), v(x, y + h)];

/** Paredes nas arestas do gramado, exceto as abertas (água). */
function edgeWalls(poly: Vec[], open: number[] = []): Wall[] {
  return poly.flatMap((a, i) => (open.includes(i) ? [] : [{ a, b: poly[(i + 1) % poly.length], r: 0 }]));
}
const blockWalls = (poly: Vec[]): Wall[] => poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length], r: 0 }));

interface Spec {
  name: string;
  par: number;
  green: Vec[];
  openEdges?: number[];
  blocks?: Vec[][];
  thin?: Wall[];
  bumpers?: Bumper[];
  movers?: Mover[];
  zones?: Zone[];
  tee: Vec;
  hole: Vec;
  route: Vec[];
  tip: string;
}

function build(id: number, s: Spec): Level {
  const xs = s.green.map((p) => p.x);
  const ys = s.green.map((p) => p.y);
  const pad = 4;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    id,
    name: s.name,
    par: s.par,
    bounds: { x: minX, y: minY, w: Math.max(...xs) + pad - minX, h: Math.max(...ys) + pad - minY },
    green: s.green,
    openEdges: s.openEdges,
    walls: [...edgeWalls(s.green, s.openEdges), ...(s.blocks ?? []).flatMap(blockWalls), ...(s.thin ?? [])],
    blocks: s.blocks ?? [],
    bumpers: s.bumpers ?? [],
    movers: s.movers ?? [],
    zones: s.zones ?? [],
    tee: s.tee,
    hole: s.hole,
    route: s.route,
    tip: s.tip,
  };
}

/** Nove buracos com dificuldade crescente. Coordenadas em unidades de jogo (u). */
export const LEVELS: Level[] = [
  build(1, {
    name: 'Primeira Tacada',
    par: 2,
    green: rect(5, 9, 50, 12),
    tee: v(10, 15),
    hole: v(49, 15),
    route: [v(10, 15), v(49, 15)],
    tip: 'Mire no buraco e ajuste a força. Bola rápida demais passa por cima do copo.',
  }),
  build(2, {
    name: 'Curva Suave',
    par: 3,
    green: [v(5, 18), v(30, 18), v(30, 3), v(42, 3), v(42, 30), v(5, 30)],
    // tee e buraco ajustados em 01/11 para existir hole in one (tabela na parede da direita, raspando a quina)
    tee: v(10, 26),
    hole: v(36, 12),
    route: [v(10, 26), v(36, 24), v(36, 12)],
    tip: 'Use a parede do fundo para virar a esquina.',
  }),
  build(3, {
    name: 'Tabela',
    par: 3,
    green: rect(5, 5, 50, 20),
    blocks: [rect(27, 9, 5, 12)],
    tee: v(10, 15),
    hole: v(49, 15),
    route: [v(10, 15), v(22, 23), v(36, 23), v(49, 15)],
    tip: 'O bloco tampa o caminho direto: passe por cima, por baixo ou de tabela.',
  }),
  build(4, {
    name: 'Subida',
    par: 3,
    green: rect(5, 8, 52, 14),
    zones: [{ kind: 'slope', poly: rect(24, 8, 8, 14), accel: v(-9, 0) }],
    bumpers: [
      { c: v(43, 11.5), r: 1.4 },
      { c: v(43, 18.5), r: 1.4 },
    ],
    tee: v(10, 15),
    hole: v(51, 15),
    route: [v(10, 15), v(38, 15), v(51, 15)],
    tip: 'A rampa freia a bola e, se faltar força, ela volta. Bata com vontade.',
  }),
  build(5, {
    name: 'Ponte da Ilha',
    par: 3,
    // ilha da saída + ponte sem paredes + ilha do buraco
    green: [v(5, 8), v(20, 8), v(20, 13), v(36, 13), v(36, 6), v(56, 6), v(56, 24), v(36, 24), v(36, 17), v(20, 17), v(20, 22), v(5, 22)],
    openEdges: [1, 2, 3, 7, 8, 9],
    zones: [
      { kind: 'water', poly: rect(20, 2, 16, 11) },
      { kind: 'water', poly: rect(20, 17, 16, 11) },
    ],
    tee: v(9, 15),
    hole: v(50, 15),
    route: [v(9, 15), v(28, 15), v(50, 15)],
    tip: 'A ponte não tem proteção: caiu na água, volta ao último ponto com 1 tacada de penalidade.',
  }),
  build(6, {
    name: 'Moinho',
    par: 3,
    green: rect(5, 8, 52, 14),
    bumpers: [{ c: v(31, 15), r: 1.3 }],
    movers: [{ kind: 'rotor', center: v(31, 15), arms: 4, length: 6.6, r: 0.35, speed: 1.1, phase: 0.4 }],
    tee: v(10, 15),
    hole: v(51, 15),
    route: [v(10, 15), v(31, 11), v(51, 15)],
    tip: 'As pás giram sem parar: espere a abertura e passe acima ou abaixo do eixo.',
  }),
  build(7, {
    name: 'Zigue-Zague',
    par: 4,
    green: rect(4, 4, 54, 24),
    // 01/11: uma fresta em cada bloco, alinhadas com o tee → atalho de hole in one (difícil: ~3 u de largura cada)
    blocks: [rect(19, 4, 2.5, 7.4), rect(19, 14.4, 2.5, 3.6), rect(39, 14, 2.5, 4.6), rect(39, 21.6, 2.5, 6.4)],
    zones: [{ kind: 'sand', poly: rect(46, 15, 8, 5) }],
    tee: v(10, 9),
    hole: v(51, 24),
    route: [v(10, 9), v(12, 24), v(30, 24), v(30, 8), v(48, 8), v(51, 24)],
    tip: 'Dois corredores em S. Cuidado com a areia antes do buraco: ela freia muito. Há duas frestas alinhadas para quem quer arriscar.',
  }),
  build(8, {
    name: 'Portão Deslizante',
    par: 3,
    green: rect(5, 8, 52, 14),
    thin: [
      { a: v(30, 8), b: v(30, 12.6), r: 0.5 },
      { a: v(30, 17.4), b: v(30, 22), r: 0.5 },
    ],
    movers: [{ kind: 'slider', x: 34, y: 12.5, w: 2.4, h: 5, travel: v(0, 4.2), period: 3.2, phase: 0 }],
    zones: [
      { kind: 'sand', poly: rect(44, 8, 6, 4) },
      { kind: 'sand', poly: rect(44, 18, 6, 4) },
    ],
    tee: v(10, 15),
    hole: v(51, 15),
    route: [v(10, 15), v(30, 15), v(51, 15)],
    tip: 'Passe pelo portão quando o bloco não estiver na frente.',
  }),
  build(9, {
    name: 'Grande Final',
    par: 4,
    green: [v(4, 18), v(36, 18), v(36, 3), v(60, 3), v(60, 21), v(44, 21), v(44, 29), v(4, 29)],
    zones: [{ kind: 'slope', poly: rect(14, 18, 12, 11), accel: v(9, 0) }],
    bumpers: [{ c: v(40, 24), r: 1.5 }],
    blocks: [rect(48, 13.5, 2.5, 7.5)], // 01/11: bloco mais baixo (antes 9–21) para existir hole in one por cima dele
    movers: [{ kind: 'rotor', center: v(42, 10), arms: 3, length: 5.2, r: 0.35, speed: -1.3, phase: 0 }],
    tee: v(8, 23.5),
    hole: v(55, 8),
    route: [v(8, 23.5), v(34, 25), v(40, 15), v(44, 5), v(55, 8)],
    tip: 'Desça a rampa, vire para cima, escape do moinho e contorne o bloco final.',
  }),
];
