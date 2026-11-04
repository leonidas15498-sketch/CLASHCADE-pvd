# Ludo (src/games/ludo) — 04/11/2026
- Tabuleiro 15×15; TRACK (52 casas, com 4 passos na diagonal nas quinas internas, como no tabuleiro real) e SEATS em logic.ts.
- Posição do peão: -1 base, 0..50 trilha relativa à saída, 51..55 corredor, 56 centro.
- 2P usa os assentos 0 (embaixo à esquerda, coral) e 1 (em cima à direita, azul). Para 4P: createLudo(4) já usa os assentos
  2 e 3 (cores âmbar e teal em index.ts SEAT_COLORS); falta o menu com 4 nomes e o Shell aceitar mais de 2 jogadores.
- IA (ai.ts) só escolhe o peão; o dado é aleatório. Bench: tests/bench/ludo.ts (400 partidas, porque a sorte pesa).
- Música: falta.
