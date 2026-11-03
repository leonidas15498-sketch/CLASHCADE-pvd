import { isUnlocked } from '../../../services/economy';
import type { BurstStyle } from '../../shared/fx';

/**
 * Temas de mesa (só visual: a física e as regras são as mesmas em todas).
 * Cada tema define madeira (borda), feltro, metal das caçapas e cor dos diamantes; a borracha das
 * tabelas e a garganta das caçapas saem do feltro, escurecido.
 */
export interface TableTheme {
  id: string;
  name: string;
  tier: 'free' | 'premium';
  /** Efeito quando uma bola cai na caçapa (só visual; mesas grátis = 'simples'). */
  burst: BurstStyle;
  description: string;
  wood: [string, string, string];
  grain: string;
  cloth: [string, string, string];
  metal: [string, string, string];
  diamond: string;
}

export const TABLE_THEMES: TableTheme[] = [
  { id: 'classica', burst: 'simples', name: 'Clássica', tier: 'free', description: 'Feltro verde e madeira de lei.', wood: ['#8a4a22', '#6b3415', '#4e240c'], grain: '#2a1206', cloth: ['#1f8a4c', '#157540', '#0d5730'], metal: ['#d9d9d9', '#8d8d8d', '#c8c8c8'], diamond: '#efe6cf' },
  { id: 'elegante', burst: 'simples', name: 'Elegante', tier: 'free', description: 'Feltro vinho e madeira escura.', wood: ['#3a1a24', '#29121d', '#1a0b12'], grain: '#000000', cloth: ['#9a2233', '#7f1826', '#4f0b18'], metal: ['#f2d89a', '#b8893a', '#e8c46e'], diamond: '#f2d89a' },
  { id: 'oceanica', burst: 'simples', name: 'Oceânica', tier: 'free', description: 'Feltro azul profundo.', wood: ['#1a6a92', '#105477', '#083a55'], grain: '#021a29', cloth: ['#0a77a3', '#08658b', '#04395e'], metal: ['#e4f6fb', '#7fb6c8', '#d2eef7'], diamond: '#bff0ff' },
  { id: 'galaxia', burst: 'galaxia', name: 'Galáxia', tier: 'premium', description: 'Feltro violeta e borda de ônix.', wood: ['#3a2058', '#2b1742', '#170b26'], grain: '#000000', cloth: ['#7542c0', '#6434aa', '#2a1566'], metal: ['#f0dcff', '#a46ae8', '#e0c4ff'], diamond: '#d9b3ff' },
  { id: 'circuito', burst: 'faiscas-vermelhas', name: 'Circuito', tier: 'premium', description: 'Grafite com filetes vermelhos.', wood: ['#22232e', '#161722', '#0b0c12'], grain: '#000000', cloth: ['#303846', '#252c37', '#10141d'], metal: ['#ff8a96', '#e44856', '#ff6b78'], diamond: '#ff5a67' },
  { id: 'ouro-negro', burst: 'faiscas', name: 'Ouro Negro', tier: 'premium', description: 'Preto fosco e metais dourados.', wood: ['#15161b', '#0a0b10', '#050508'], grain: '#000000', cloth: ['#2c2f33', '#242629', '#0e1218'], metal: ['#fff0b8', '#c9962f', '#f0cd6a'], diamond: '#e8bc53' },
  { id: 'selva', burst: 'folhas', name: 'Selva', tier: 'premium', description: 'Verde-folha e madeira rústica.', wood: ['#6b5a2a', '#53451f', '#3a3014'], grain: '#1d1708', cloth: ['#3f9140', '#367e37', '#174a2a'], metal: ['#d8f0c4', '#89c965', '#c4e6a8'], diamond: '#c4e6a8' },
  { id: 'campeonato', burst: 'confete', name: 'Campeonato', tier: 'premium', description: 'Azul de torneio, como na TV.', wood: ['#9a6030', '#835027', '#5e3819'], grain: '#2a1206', cloth: ['#1766a0', '#125688', '#08345a'], metal: ['#fff3d6', '#c79a4a', '#f4c06d'], diamond: '#f4c06d' },
  { id: 'halloween', burst: 'abobora', name: 'Halloween', tier: 'premium', description: 'Roxo noturno com metais âmbar.', wood: ['#33183a', '#271329', '#160a18'], grain: '#000000', cloth: ['#6d2577', '#5b1c63', '#260f44'], metal: ['#ffd29a', '#ff9f32', '#ffbb6a'], diamond: '#ff9f32' },
];

export const DEFAULT_TABLE = 'classica';
export const tableById = (id: string | undefined) => TABLE_THEMES.find((t) => t.id === id) ?? TABLE_THEMES[0];
export const isTableAvailable = (t: TableTheme) => isUnlocked(`pool.table.${t.id}`);

/** Escurece (k < 0) ou clareia (k > 0) uma cor #rrggbb. */
export function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
