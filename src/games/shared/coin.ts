/**
 * Sorteio de quem começa (pedido do Leon, 05/11: "sempre começava o J1, injusto").
 * Primeira partida sorteada; nas revanches cada jogo alterna, para ninguém começar sempre.
 */
export function coinFlip(rng: () => number = Math.random): 0 | 1 {
  return rng() < 0.5 ? 0 : 1;
}

