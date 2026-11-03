# QA no navegador
1. `npm run build && npx vite preview --port 4174 --strictPort` (em segundo plano).
2. `node qa/fx-golfe-hockey.cjs <pasta-de-saida>` — sinuca (rastro, explosão real na caçapa, aba Rastro),
   golfe (bola lenta cai sem aviso; rápida dá "Forte demais!"), hockey (música carrega), erros de console.
   Imprime números; capturas vão para a pasta de saída.

## Rodada 01/11 noite (4)
- `node qa/torre-feel.cjs <saída>` — Torre: faixa de vez, impactos/tremor, zoom da câmera e base sempre na tela (em pé e deitado).
- `node qa/torneio.cjs <saída>` — Modo Torneio: abre o 1º jogo sorteado no 2P, conta resultado uma vez, "Próximo jogo", placar no portal.
- `node qa/sumo.cjs <saída>` — Sumô Neon: joystick, avanço, partida contra IA até o fim, dois dedos (multitoque por CDP).
- `node qa/cabo.cjs <saída>` — Cabo de Guerra: toque no tempo, dois dedos na mesma batida, metralhar escorrega, IA termina.
- `smoke-todos.cjs`, `i18n-faltando.cjs` e `fps.cjs` já incluem os dois jogos novos.
