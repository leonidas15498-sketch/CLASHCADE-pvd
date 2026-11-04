/**
 * Temas da loja dos jogos do Shell (pedido do Leon, 03/11: cada jogo com a SUA loja, incluindo personalizar a
 * mesa/quadra). Só cores que o próprio renderizador usa para desenhar — nunca filtro CSS. Física e regras iguais.
 * Preço e categoria vêm do catálogo único (src/services/catalog.ts); aqui ficam só nome em inglês e paleta.
 * O item escolhido fica salvo por aparelho; se deixar de estar liberado (ex.: Premium desligado), volta ao padrão.
 */
import { createStore } from '../../services/storage';
import { isUnlocked } from '../../services/economy';
import { itemByKey } from '../../services/catalog';

export interface ShopTheme<P> {
  key: string;
  en: string;
  descPt: string;
  descEn: string;
  pal: P;
}

// ---------- Air Hockey ----------
export interface HockeyTablePal { rail: string; top: string; bottom: string; holes: string; line: string; dark: boolean; stars?: boolean }
export const HOCKEY_TABLES: ShopTheme<HockeyTablePal>[] = [
  { key: 'hockey.table.classica', en: 'Classic', descPt: 'Branca com trilho azul-marinho.', descEn: 'White with a navy rail.', pal: { rail: '#1b2b4a', top: '#f4f8fc', bottom: '#dbe6f1', holes: 'rgba(30,50,80,0.13)', line: 'rgba(200,40,60,0.55)', dark: false } },
  { key: 'hockey.table.gelo', en: 'Ice Rink', descPt: 'Gelo azulado com linhas de rinque.', descEn: 'Bluish ice with rink lines.', pal: { rail: '#2f5d86', top: '#eaf8ff', bottom: '#b9e3f7', holes: 'rgba(40,110,160,0.12)', line: 'rgba(40,120,200,0.6)', dark: false } },
  { key: 'hockey.table.grafite', en: 'Graphite Neon', descPt: 'Grafite escuro com borda ciano.', descEn: 'Dark graphite with a cyan rim.', pal: { rail: '#00b8d4', top: '#232c42', bottom: '#151b2b', holes: 'rgba(255,255,255,0.06)', line: 'rgba(0,224,255,0.6)', dark: true } },
  { key: 'hockey.table.madeira', en: 'Wooden Arcade', descPt: 'Madeira clara de fliperama antigo.', descEn: 'Light wood from an old arcade.', pal: { rail: '#5a3518', top: '#e0b27a', bottom: '#c08a52', holes: 'rgba(70,35,10,0.18)', line: 'rgba(120,40,20,0.55)', dark: false } },
  { key: 'hockey.table.lava', en: 'Lava', descPt: 'Pedra vulcânica com veios brilhando.', descEn: 'Volcanic stone with glowing veins.', pal: { rail: '#2a0d06', top: '#3a1a12', bottom: '#1c0b07', holes: 'rgba(255,120,40,0.12)', line: 'rgba(255,110,30,0.75)', dark: true } },
  { key: 'hockey.table.galaxia', en: 'Galaxy', descPt: 'Céu roxo com estrelas.', descEn: 'Purple sky with stars.', pal: { rail: '#2b1650', top: '#2a1d5c', bottom: '#120b2e', holes: 'rgba(255,255,255,0.05)', line: 'rgba(202,134,255,0.65)', dark: true, stars: true } },
];
export interface HockeyPuckPal { body: string; ring: string; glow?: string }
export const HOCKEY_PUCKS: ShopTheme<HockeyPuckPal>[] = [
  { key: 'hockey.puck.classico', en: 'Classic', descPt: 'Preto com anel âmbar.', descEn: 'Black with an amber ring.', pal: { body: '#1d1f26', ring: '#ffc93c' } },
  { key: 'hockey.puck.ambar', en: 'Amber', descPt: 'Âmbar com anel escuro.', descEn: 'Amber with a dark ring.', pal: { body: '#ffc24a', ring: '#7a4b00' } },
  { key: 'hockey.puck.cristal', en: 'Crystal', descPt: 'Azul-gelo translúcido.', descEn: 'Translucent ice blue.', pal: { body: '#9fe9ff', ring: '#ffffff' } },
  { key: 'hockey.puck.neon', en: 'Neon Ring', descPt: 'Escuro com anel ciano que brilha.', descEn: 'Dark with a glowing cyan ring.', pal: { body: '#0d1426', ring: '#00e0ff', glow: '#00e0ff' } },
];

// ---------- Pong ----------
export interface PongCourtPal { rail: string; floor: string; line: string; net: string; score: string; stars?: boolean }
export const PONG_COURTS: ShopTheme<PongCourtPal>[] = [
  { key: 'pong.court.classica', en: 'Classic', descPt: 'Azul-noite com linhas brancas.', descEn: 'Night blue with white lines.', pal: { rail: '#0c1a2e', floor: '#0c1a2e', line: 'rgba(255,255,255,0.55)', net: 'rgba(255,255,255,0.35)', score: 'rgba(255,255,255,0.08)' } },
  { key: 'pong.court.synthwave', en: 'Synthwave', descPt: 'Roxo com linhas rosa e ciano.', descEn: 'Purple with pink and cyan lines.', pal: { rail: '#170826', floor: '#2a0f45', line: 'rgba(255,79,216,0.8)', net: 'rgba(0,224,255,0.55)', score: 'rgba(255,79,216,0.12)' } },
  { key: 'pong.court.gelo', en: 'Ice', descPt: 'Gelo claro com linhas azuis.', descEn: 'Light ice with blue lines.', pal: { rail: '#2f5d86', floor: '#a9d8f0', line: 'rgba(20,70,120,0.6)', net: 'rgba(20,70,120,0.4)', score: 'rgba(20,70,120,0.12)' } },
  { key: 'pong.court.madeira', en: 'Wood', descPt: 'Piso de madeira de ginásio.', descEn: 'Gym wooden floor.', pal: { rail: '#4a2a12', floor: '#9c6a39', line: 'rgba(255,248,230,0.75)', net: 'rgba(255,248,230,0.45)', score: 'rgba(60,30,10,0.18)' } },
  { key: 'pong.court.lava', en: 'Lava', descPt: 'Pedra escura com linhas em brasa.', descEn: 'Dark stone with ember lines.', pal: { rail: '#1c0b07', floor: '#2e140d', line: 'rgba(255,110,30,0.8)', net: 'rgba(255,170,60,0.5)', score: 'rgba(255,110,30,0.1)' } },
  { key: 'pong.court.galaxia', en: 'Galaxy', descPt: 'Céu roxo com estrelas.', descEn: 'Purple sky with stars.', pal: { rail: '#120b2e', floor: '#1e1450', line: 'rgba(202,134,255,0.7)', net: 'rgba(202,134,255,0.45)', score: 'rgba(255,255,255,0.07)', stars: true } },
];
export interface PongBallPal { color: string }
export const PONG_BALLS: ShopTheme<PongBallPal>[] = [
  { key: 'pong.ball.classica', en: 'Classic', descPt: 'Branca.', descEn: 'White.', pal: { color: '#ffffff' } },
  { key: 'pong.ball.ambar', en: 'Amber', descPt: 'Âmbar quente.', descEn: 'Warm amber.', pal: { color: '#ffc24a' } },
  { key: 'pong.ball.teal', en: 'Teal', descPt: 'Verde-água.', descEn: 'Teal green.', pal: { color: '#28c7b7' } },
  { key: 'pong.ball.neon', en: 'Neon', descPt: 'Ciano bem brilhante.', descEn: 'Bright cyan.', pal: { color: '#00e0ff' } },
];

// ---------- Quatro em Linha ----------
export interface C4BoardPal { top: string; bottom: string; edge: string }
export const C4_BOARDS: ShopTheme<C4BoardPal>[] = [
  { key: 'c4.board.classico', en: 'Classic', descPt: 'Roxo original do jogo.', descEn: 'The original purple.', pal: { top: '#4a3f99', bottom: '#2b2366', edge: '#221b52' } },
  { key: 'c4.board.madeira', en: 'Wood', descPt: 'Madeira envernizada.', descEn: 'Varnished wood.', pal: { top: '#b98149', bottom: '#8a5a2b', edge: '#4f2f12' } },
  { key: 'c4.board.grafite', en: 'Graphite', descPt: 'Grafite com borda ciano.', descEn: 'Graphite with a cyan edge.', pal: { top: '#323b54', bottom: '#1b2337', edge: '#00b8d4' } },
  { key: 'c4.board.ouro', en: 'Gold', descPt: 'Dourado brilhante.', descEn: 'Shiny gold.', pal: { top: '#ffd77a', bottom: '#c9962f', edge: '#7a5510' } },
];

// ---------- Item equipado (por aparelho) ----------
type Equipped = Record<string, string>;
const isRec = (x: unknown): x is Equipped => !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((v) => typeof v === 'string');
const store = createStore<Equipped>('clashcade.equipped.v1', 1, () => ({}), isRec);

/** Tema equipado no espaço `slot` (ex.: 'hockey.table'); cai no primeiro (padrão) se o salvo não vale. */
export function equipped<P>(slot: string, list: ShopTheme<P>[]): ShopTheme<P> {
  const k = store.load()[slot];
  const found = k ? list.find((x) => x.key === k) : undefined;
  return found && itemByKey(found.key) && isUnlocked(found.key) ? found : list[0];
}
export function equip(slot: string, key: string) {
  if (!isUnlocked(key)) return false;
  const e = store.load();
  e[slot] = key;
  store.save(e);
  return true;
}

// ---------- Damas ----------
export interface CheckersBoardPal { light: string; dark: string; frame: string }
export const CHECKERS_BOARDS: ShopTheme<CheckersBoardPal>[] = [
  { key: 'checkers.board.madeira', en: 'Wood', descPt: 'Madeira clara e escura, o clássico.', descEn: 'Light and dark wood, the classic.', pal: { light: '#f0d9b5', dark: '#a8703f', frame: '#5a3518' } },
  { key: 'checkers.board.marmore', en: 'Marble', descPt: 'Mármore branco e verde.', descEn: 'White and green marble.', pal: { light: '#ece8df', dark: '#3f7a5f', frame: '#2a3a33' } },
  { key: 'checkers.board.arena', en: 'Arena', descPt: 'Azul-marinho com borda ciano.', descEn: 'Navy with a cyan rim.', pal: { light: '#2a3657', dark: '#151d36', frame: '#00b8d4' } },
  { key: 'checkers.board.ouro', en: 'Gold', descPt: 'Creme com casas douradas.', descEn: 'Cream with golden squares.', pal: { light: '#fff3d1', dark: '#c9962f', frame: '#7a5510' } },
];
