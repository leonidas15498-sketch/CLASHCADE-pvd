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

/** Buracos com dificuldade crescente (9 originais + 3 novos em 05/11). Coordenadas em unidades de jogo (u). */
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
    // 05/11: bloco 5→4 de altura e curso 4,2→3,4: antes sobrava só 0,3 u entre o bloco e a parede e a bola ficava espremida
    // (presa até 25 s). Agora sobram 1,6 u (bola tem 1,4); a abertura no extremo segue ~3,8 u (antes 4,1).
    movers: [{ kind: 'slider', x: 34, y: 13, w: 2.4, h: 4, travel: v(0, 3.4), period: 3.2, phase: 0 }],
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
  // ---- 05/11 (pedido do Leon: mais fases) ----
  build(10, {
    name: 'Fliperama',
    par: 3,
    green: rect(5, 5, 52, 22),
    // para-choques elásticos em losango; as tabelas nos pinos abrem caminho
    bumpers: [
      { c: v(24, 11), r: 1.4, restitution: 0.9 },
      { c: v(24, 21), r: 1.4, restitution: 0.9 },
      { c: v(31, 16), r: 1.6, restitution: 0.9 }, // um pouco abaixo da linha: a reta passa raspando (hole in one difícil)
      { c: v(38, 11), r: 1.4, restitution: 0.9 },
      { c: v(38, 21), r: 1.4, restitution: 0.9 },
    ],
    tee: v(10, 16),
    // copo um pouco acima do eixo: a reta bate no pino de cima; hole in one só de tabela (raro, como no Zigue-Zague)
    hole: v(51, 12),
    route: [v(10, 16), v(31, 13), v(51, 12)],
    tip: 'Os pinos quicam forte. Passe entre eles ou use a tabela, mas sem exagerar na força.',
  }),
  build(11, {
    name: 'Moinho Duplo',
    par: 3,
    green: rect(5, 8, 52, 14),
    bumpers: [
      { c: v(22, 15), r: 1.2 },
      { c: v(40, 15), r: 1.2 },
    ],
    movers: [
      // pás de 5 u: sobra uma fresta de 1,65 u junto às paredes (a bola tem 1,4) — caminho de precisão sem esperar
      { kind: 'rotor', center: v(22, 15), arms: 2, length: 5, r: 0.35, speed: 1.6, phase: 0 },
      { kind: 'rotor', center: v(40, 15), arms: 2, length: 5, r: 0.35, speed: -1.6, phase: 1.2 },
    ],
    tee: v(9, 15),
    hole: v(52, 15),
    route: [v(9, 15), v(22, 11), v(31, 15), v(40, 19), v(52, 15)],
    tip: 'Dois moinhos girando em sentidos opostos. Dá para parar no meio deles e esperar a próxima abertura.',
  }),
  build(12, {
    name: 'Lago Central',
    par: 3,
    green: rect(4, 4, 54, 24),
    zones: [
      { kind: 'water', poly: rect(20, 11.5, 22, 9) },
      { kind: 'sand', poly: rect(12, 22.5, 7, 5.5) },
    ],
    // pino pequeno no ponto da tabela de baixo: o hole in one por tabela fica raro (antes saía fácil demais)
    bumpers: [{ c: v(31, 7.7), r: 0.8 }, { c: v(31, 27.3), r: 0.5 }],
    movers: [{ kind: 'rotor', center: v(31, 7.7), arms: 2, length: 2.8, r: 0.3, speed: 2.2, phase: 0 }],
    tee: v(9, 16),
    hole: v(53, 16),
    route: [v(9, 16), v(16, 25), v(46, 25), v(53, 16)],
    tip: 'Contorne o lago: por cima é rápido mas tem um moinho; por baixo é seguro, mas a areia freia.',
  }),
];
