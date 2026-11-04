# Damas (src/games/checkers) — 04/11/2026
- Regras brasileiras em logic.ts (comentário no topo). Casas: índice = linha·8 + coluna; linha 0 = lado do Jogador 2 (azul).
- Captura: busca em profundidade numa cópia do tabuleiro sem a peça de origem; peças tomadas ficam no tabuleiro até o fim do
  lance (bloqueiam e não podem ser puladas de novo). Lei da maioria aplicada em legalMoves.
- IA (ai.ts): minimax alfa-beta, profundidade 1/3/6; lance único não gasta profundidade. Bench: tests/bench/checkers.ts.
- Interface: toque na peça → destinos com a rota tracejada; animação por trecho (0,2 s), pulo em captura; peça tomada apaga.
- Loja: tabuleiros em shared/arenaThemes.ts (CHECKERS_BOARDS). Música: falta.
- **Opção "Pedra captura para trás?" (04/11, pedido do Leon):** Sim (oficial, padrão) / Não (variante caseira, como no checkers
  americano; dama não muda). Fica no menu via `variants` do Shell (genérico: qualquer jogo pode ter opções de regra),
  salvo por aparelho em `clashcade.checkers.variants`. Regra pesquisada: na regra brasileira oficial a pedra só ANDA para a
  frente, mas CAPTURA para a frente e para trás — o comportamento antigo estava certo.
