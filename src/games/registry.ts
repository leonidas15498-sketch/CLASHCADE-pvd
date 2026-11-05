import type { GameModule } from './shared/types';

export type GameStatus = 'available' | 'in-development';

export interface GameEntry {
  id: string;
  name: string;
  description: string;
  /** Rota no hash da URL (#id). */
  route: string;
  cover: 'pool' | 'minigolf' | 'hockey' | 'trails' | 'stack' | 'connect4' | 'pong' | 'blocks' | 'sumo' | 'tug' | 'checkers' | 'ludo' | 'snake' | 'chess';
  modes: string[];
  highlights: string[];
  status: GameStatus;
  /** Jogo de tabuleiro (aparece no filtro "Tabuleiro" do portal). */
  board?: boolean;
  /** Mostra o selo "Novo" na capa (jogos recém-chegados). */
  isNew?: boolean;
  /** Carregamento sob demanda: o código do jogo só é baixado quando ele é aberto. */
  load?: () => Promise<{ default: GameModule }>;
}

export const GAMES: GameEntry[] = [
  {
    id: 'sinuca',
    name: 'Sinuca 8-Ball',
    description: 'Mesa de 9 pés com física de verdade: efeito, tabelas, caçapas e regras de 8 bolas.',
    route: 'sinuca',
    cover: 'pool',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Regras de sinuca 8-Ball', 'Física realista', 'Mira e força pelo taco'],
    status: 'available',
    load: () => import('./pool'),
  },
  {
    id: 'minigolfe',
    name: 'Minigolfe',
    description: 'Nove buracos numa ilha tropical: curvas, rampas, moinho e água. Menor número de tacadas vence.',
    route: 'minigolfe',
    cover: 'minigolf',
    modes: ['1P', '1P contra IA', '2P local por turnos'],
    highlights: ['Circuito de 12 buracos em ordem sorteada', 'Física consistente', 'Mira e barra de força'],
    status: 'available',
    load: () => import('./minigolf'),
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    description: 'Disco rápido sobre colchão de ar: contra a IA ou com um amigo, cada um numa ponta da tela.',
    route: 'air-hockey',
    cover: 'hockey',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Primeiro a 7 gols', 'Multitoque: um em cada lado da tela', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./airhockey'),
  },
  {
    id: 'duelo-rastros',
    name: 'Duelo de Rastros',
    description: 'Motos de luz deixam rastro na arena: feche o caminho do rival e não bata. Melhor de 5 rodadas.',
    route: 'duelo-rastros',
    cover: 'trails',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Os dois jogam ao mesmo tempo', 'Deslize para virar', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./trails'),
  },
  {
    id: 'empilha',
    name: 'Torre de Bichinhos',
    description: 'Tartaruga, hipopótamo, canguru, caracol… Cada um coloca um bicho na pilha. Quem derrubar perde!',
    route: 'empilha',
    cover: 'stack',
    modes: ['1P sozinho', '1P contra IA', '2P local por turnos'],
    highlights: ['Física de verdade: as peças tombam', 'Gire e solte no ponto certo', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./stack'),
  },
  {
    id: 'lig-4',
    name: 'Quatro em Linha',
    description: 'Solte as peças na grade e alinhe 4 da sua cor antes do adversário: na horizontal, vertical ou diagonal.',
    route: 'lig-4',
    cover: 'connect4',
    board: true,
    modes: ['1P contra IA', '2P local por turnos'],
    highlights: ['Partidas rápidas', 'Revanche alterna quem começa', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./connect4'),
  },
  {
    id: 'pong',
    name: 'Pong',
    description: 'O clássico das raquetes: rebata, incline a bola com a ponta da raquete e não deixe passar.',
    route: 'pong',
    cover: 'pong',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Primeiro a 7 pontos', 'Os dois jogam ao mesmo tempo', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./pong'),
  },
  {
    id: 'blocos',
    name: 'Blocos Cromáticos',
    description: 'Encaixe as peças na grade 8×8, complete linhas e colunas e encadeie combos para multiplicar os pontos.',
    route: 'blocos',
    cover: 'blocks',
    modes: ['1P (recorde)', '1P contra IA', '2P local, um de cada vez'],
    highlights: ['Combos até ×5', 'Faixas Bronze a Diamante', 'Partidas de poucos minutos'],
    status: 'available',
    load: () => import('./blocks'),
  },
  {
    id: 'sumo-neon',
    name: 'Sumô Neon',
    description: 'Empurre o rival para fora do ringue neon. Joystick para mover, toque rápido para dar o tranco. Melhor de 3.',
    route: 'sumo-neon',
    cover: 'sumo',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Rounds de segundos', 'Os dois jogam ao mesmo tempo', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./sumo'),
  },
  {
    id: 'cabo-de-guerra',
    name: 'Cabo de Guerra',
    description: 'Toque no tempo da batida para puxar a corda. Errar o ritmo faz escorregar: metralhar o botão não adianta.',
    route: 'cabo-de-guerra',
    cover: 'tug',
    modes: ['1P contra IA', '2P local'],
    highlights: ['Jogo de ritmo', 'Os dois jogam ao mesmo tempo', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./tug'),
  },
  {
    id: 'damas',
    name: 'Damas',
    description: 'O clássico de tabuleiro com regras brasileiras: captura obrigatória, lei da maioria e dama voadora.',
    route: 'damas',
    cover: 'checkers',
    board: true,
    isNew: true,
    modes: ['1P contra IA', '2P local por turnos'],
    highlights: ['Regras brasileiras', 'Mostra os lances possíveis', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./checkers'),
  },
  {
    id: 'ludo',
    name: 'Ludo',
    description: 'Role o dado, tire seus 4 peões da base e leve todos ao centro. Capture o rival para mandá-lo de volta!',
    route: 'ludo',
    cover: 'ludo',
    board: true,
    isNew: true,
    modes: ['1P contra IA', '2P local por turnos'],
    highlights: ['Dado de verdade, sorte e estratégia', '4 jogadores em breve', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./ludo'),
  },
  {
    id: 'xadrez',
    name: 'Xadrez',
    description: 'Regras oficiais completas: roque, en passant, promoção, xeque-mate e todos os empates.',
    route: 'xadrez',
    cover: 'chess',
    board: true,
    isNew: true,
    modes: ['1P contra IA', '2P local por turnos'],
    highlights: ['Regras oficiais', 'Mostra os lances possíveis', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./chess'),
  },
  {
    id: 'cobrinha',
    name: 'Cobrinha',
    description: 'O clássico Snake: coma as frutas, cresça e não bata. Sozinho pelo recorde ou em duelo de cobras.',
    route: 'cobrinha',
    cover: 'snake',
    isNew: true,
    modes: ['1P (recorde)', '1P contra IA', '2P local'],
    highlights: ['Deslize para virar', 'Duelo: os dois ao mesmo tempo', 'IA em 3 níveis'],
    status: 'available',
    load: () => import('./snake'),
  },
];

export const gameByRoute = (route: string) => GAMES.find((g) => g.route === route);
