/**
 * Padrão da plataforma para partidas locais: cada jogador tem SEMPRE a mesma cor em todos os jogos,
 * e o fundo da tela fica na cor de quem joga.
 */
export const PLAYER_COLORS = ['#ff6b4a', '#3d8bff'] as const;
export const PLAYER_COLOR_NAMES = ['coral', 'azul'] as const;

/** Aplica a cor da vez num elemento raiz do jogo (variável CSS --turn). */
export function setTurnColor(root: HTMLElement, player: number | null): void {
  root.style.setProperty('--turn', player === null ? 'transparent' : PLAYER_COLORS[player % 2]);
}
