/**
 * Catálogo de cosméticos (fonte única de preço e categoria). Decisão do Leon (01/11):
 * - 'default': o item padrão de cada categoria, liberado para todos.
 * - 'coins': comprado com Fichas ganhas jogando.
 * - 'premium': só com a compra do Premium (que também remove anúncios). Só visual, nenhuma vantagem.
 * - Sazonais (ex.: Halloween) podem ter versão por fichas e versão premium; o Premium sempre inclui uma sazonal.
 * Preços são hipóteses iniciais para balancear jogando (com 30/dia de bônus + até 60/dia de partidas + 80 de desafios).
 * O teste tests/economy garante que todo item dos jogos existe aqui.
 */
export type ItemTier = 'default' | 'coins' | 'premium';
export interface CatalogItem {
  key: string;
  game: 'sinuca' | 'minigolfe' | 'efeitos' | 'air-hockey' | 'pong' | 'lig-4';
  kind: 'taco' | 'mesa' | 'campo' | 'rastro' | 'disco' | 'quadra' | 'bola' | 'tabuleiro';
  name: string;
  tier: ItemTier;
  price: number;
  /** Cor da amostra na loja. */
  swatch: string;
  seasonal?: 'halloween';
}

const it = (key: string, game: CatalogItem['game'], kind: CatalogItem['kind'], name: string, tier: ItemTier, price: number, swatch: string, seasonal?: 'halloween'): CatalogItem => ({
  key,
  game,
  kind,
  name,
  tier,
  price: tier === 'coins' ? price : 0,
  swatch,
  seasonal,
});

export const CATALOG: CatalogItem[] = [
  // Sinuca — tacos
  it('pool.cue.classico', 'sinuca', 'taco', 'Clássico', 'default', 0, '#c9a46a'),
  it('pool.cue.ebano', 'sinuca', 'taco', 'Ébano', 'coins', 120, '#2a1d17'),
  it('pool.cue.oceano', 'sinuca', 'taco', 'Oceano', 'coins', 150, '#1f7fb0'),
  it('pool.cue.dragao', 'sinuca', 'taco', 'Dragão', 'premium', 0, '#c0392b'),
  it('pool.cue.neon', 'sinuca', 'taco', 'Neon', 'premium', 0, '#00e5ff'),
  it('pool.cue.marmore', 'sinuca', 'taco', 'Mármore', 'premium', 0, '#e8e4dc'),
  // Sinuca — mesas
  it('pool.table.classica', 'sinuca', 'mesa', 'Clássica', 'default', 0, '#1f8a4c'),
  it('pool.table.elegante', 'sinuca', 'mesa', 'Elegante', 'coins', 150, '#9a2233'),
  it('pool.table.oceanica', 'sinuca', 'mesa', 'Oceânica', 'coins', 200, '#0a77a3'),
  it('pool.table.galaxia', 'sinuca', 'mesa', 'Galáxia', 'premium', 0, '#7542c0'),
  it('pool.table.circuito', 'sinuca', 'mesa', 'Circuito', 'premium', 0, '#303846'),
  it('pool.table.ouro-negro', 'sinuca', 'mesa', 'Ouro Negro', 'premium', 0, '#c9962f'),
  it('pool.table.selva', 'sinuca', 'mesa', 'Selva', 'premium', 0, '#3f9140'),
  it('pool.table.campeonato', 'sinuca', 'mesa', 'Campeonato', 'premium', 0, '#1766a0'),
  it('pool.table.halloween', 'sinuca', 'mesa', 'Halloween', 'premium', 0, '#6d2577', 'halloween'),
  // Minigolfe — tacos
  it('golf.putter.classico', 'minigolfe', 'taco', 'Clássico', 'default', 0, '#d9dfe4'),
  it('golf.putter.madeira', 'minigolfe', 'taco', 'Madeira', 'coins', 100, '#8a5a2b'),
  it('golf.putter.coral', 'minigolfe', 'taco', 'Coral', 'coins', 120, '#ff8a6a'),
  it('golf.putter.custom', 'minigolfe', 'taco', 'Personalizado', 'coins', 200, '#ffc93c'),
  it('golf.putter.ouro', 'minigolfe', 'taco', 'Ouro', 'premium', 0, '#ffe28a'),
  it('golf.putter.neon', 'minigolfe', 'taco', 'Neon', 'premium', 0, '#00e5ff'),
  it('golf.putter.oceanico', 'minigolfe', 'taco', 'Oceânico', 'premium', 0, '#00dded'),
  it('golf.putter.galaxia', 'minigolfe', 'taco', 'Galáxia', 'premium', 0, '#ca86ff'),
  it('golf.putter.halloween', 'minigolfe', 'taco', 'Halloween', 'premium', 0, '#ff9b3c', 'halloween'),
  it('golf.putter.ouro-negro', 'minigolfe', 'taco', 'Ouro Negro', 'premium', 0, '#e8bc53'),
  it('golf.putter.selva', 'minigolfe', 'taco', 'Selva', 'premium', 0, '#89c965'),
  it('golf.putter.campeonato', 'minigolfe', 'taco', 'Campeonato', 'premium', 0, '#0e3f6e'),
  // Minigolfe — campos
  it('golf.course.tropical', 'minigolfe', 'campo', 'Ilha Tropical', 'default', 0, '#3fae49'),
  it('golf.course.floresta', 'minigolfe', 'campo', 'Floresta', 'coins', 150, '#2f8a3e'),
  it('golf.course.deserto', 'minigolfe', 'campo', 'Deserto', 'coins', 150, '#d9a35f'),
  it('golf.course.noturno', 'minigolfe', 'campo', 'Noturno', 'coins', 200, '#141c3a'),
  it('golf.course.halloween', 'minigolfe', 'campo', 'Halloween', 'coins', 300, '#ff9f32', 'halloween'),
  // Rastros (sinuca e golfe)
  it('fx.trail.nenhum', 'efeitos', 'rastro', 'Sem rastro', 'default', 0, '#555b6e'),
  it('fx.trail.sombra', 'efeitos', 'rastro', 'Sombra', 'default', 0, '#9aa3ab'),
  it('fx.trail.chama', 'efeitos', 'rastro', 'Chama', 'premium', 0, '#ff7a1a'),
  it('fx.trail.neon', 'efeitos', 'rastro', 'Neon', 'premium', 0, '#00e5ff'),
  it('fx.trail.estrelas', 'efeitos', 'rastro', 'Estrelas', 'premium', 0, '#ffd84d'),
  it('fx.trail.fumaca', 'efeitos', 'rastro', 'Fumaça roxa', 'premium', 0, '#9b59d0'),
  it('fx.trail.morcegos', 'efeitos', 'rastro', 'Morcegos', 'premium', 0, '#3a2a4a', 'halloween'),
  // Air Hockey — mesas e discos (03/11: loja dentro do jogo; desenhados pelo renderizador, física igual)
  it('hockey.table.classica', 'air-hockey', 'mesa', 'Clássica', 'default', 0, '#e8eff7'),
  it('hockey.table.gelo', 'air-hockey', 'mesa', 'Pista de Gelo', 'coins', 120, '#bfe8ff'),
  it('hockey.table.grafite', 'air-hockey', 'mesa', 'Grafite Neon', 'coins', 150, '#1b2337'),
  it('hockey.table.madeira', 'air-hockey', 'mesa', 'Fliperama de Madeira', 'coins', 150, '#b07a45'),
  it('hockey.table.lava', 'air-hockey', 'mesa', 'Lava', 'premium', 0, '#ff5a1f'),
  it('hockey.table.galaxia', 'air-hockey', 'mesa', 'Galáxia', 'premium', 0, '#7542c0'),
  it('hockey.puck.classico', 'air-hockey', 'disco', 'Clássico', 'default', 0, '#1d1f26'),
  it('hockey.puck.ambar', 'air-hockey', 'disco', 'Âmbar', 'coins', 80, '#ffc24a'),
  it('hockey.puck.cristal', 'air-hockey', 'disco', 'Cristal', 'coins', 100, '#9fe9ff'),
  it('hockey.puck.neon', 'air-hockey', 'disco', 'Anel Neon', 'premium', 0, '#00e0ff'),
  // Pong — quadras e bolas
  it('pong.court.classica', 'pong', 'quadra', 'Clássica', 'default', 0, '#0c1a2e'),
  it('pong.court.synthwave', 'pong', 'quadra', 'Synthwave', 'coins', 120, '#2a0f45'),
  it('pong.court.gelo', 'pong', 'quadra', 'Gelo', 'coins', 120, '#cfeeff'),
  it('pong.court.madeira', 'pong', 'quadra', 'Madeira', 'coins', 150, '#a8743f'),
  it('pong.court.lava', 'pong', 'quadra', 'Lava', 'premium', 0, '#ff5a1f'),
  it('pong.court.galaxia', 'pong', 'quadra', 'Galáxia', 'premium', 0, '#7542c0'),
  it('pong.ball.classica', 'pong', 'bola', 'Clássica', 'default', 0, '#ffffff'),
  it('pong.ball.ambar', 'pong', 'bola', 'Âmbar', 'coins', 80, '#ffc24a'),
  it('pong.ball.teal', 'pong', 'bola', 'Teal', 'coins', 80, '#28c7b7'),
  it('pong.ball.neon', 'pong', 'bola', 'Neon', 'premium', 0, '#00e0ff'),
  // Quatro em Linha — tabuleiros (as peças continuam coral × azul, padrão de cores da plataforma)
  it('c4.board.classico', 'lig-4', 'tabuleiro', 'Clássico', 'default', 0, '#4a3f99'),
  it('c4.board.madeira', 'lig-4', 'tabuleiro', 'Madeira', 'coins', 120, '#a8743f'),
  it('c4.board.grafite', 'lig-4', 'tabuleiro', 'Grafite', 'coins', 120, '#2a3247'),
  it('c4.board.ouro', 'lig-4', 'tabuleiro', 'Ouro', 'premium', 0, '#ffc24a'),
];

const BY_KEY = new Map(CATALOG.map((x) => [x.key, x]));
export const itemByKey = (key: string) => BY_KEY.get(key);
