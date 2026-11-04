# Xadrez (src/games/chess) — 04/11/2026
- Regras oficiais (FIDE) em logic.ts: roque, en passant, promoção com escolha, só lances legais; fim por mate, afogamento,
  50 lances, tripla repetição e material insuficiente. Brancas = Jogador 1 (coral), embaixo, começam.
- Gerador validado por **perft** (contagem de posições com números de referência conhecidos, incl. "Kiwipete") em tests/chess.
- IA (ai.ts): negamax alfa-beta + tabelas de posição + quiescência; Fácil prof. 1 com sorteio entre lances até 1,5 peão piores;
  Médio prof. 2; Difícil aprofundamento iterativo até 4 com limite de 1,5 s (no navegador, ~0,9 s por lance).
  Repetição conta como empate na busca (sem isso a IA ganhando repetia lances). Bench (tests/bench/chess.ts, teto 160
  meios-lances adjudicado por ±3 peões): Médio × Fácil 100%, Difícil × Médio 100% dos pontos (8 e 6 partidas).
- Bug achado e corrigido na medição: ruído aleatório somado à nota na raiz do alfa-beta fazia o Médio escolher lances
  "cortados" (entregava torre). Ruído agora só no Fácil (janela cheia).
- A IA roda na linha principal (sem Web Worker): o jogo desenha "IA pensando…" e a tela congela até ~1,5 s no Difícil.
  Se incomodar no celular, próximo passo é mover a busca para um Worker.
- Interface: toque na peça → pontos nos destinos (anel nas capturas); escolha de promoção numa caixa sobre o tabuleiro;
  rei em xeque com brilho vermelho; placar mostra o material capturado (+pontos). Peças desenhadas por caminhos (sem
  fonte/emoji). Loja: tabuleiros CHESS_BOARDS (Madeira, Torneio 120, Arena 120, Mármore★). Música: falta.
