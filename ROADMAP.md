# ROADMAP — Jogaço

## Feito (01/11/2026)
- Portal com catálogo, carregamento sob demanda, saída limpa dos jogos.
- Sinuca integrada sem mudar a física (exceto a caçapa: área de queda = buraco desenhado, pedido do Leon).
- Minigolfe completo: 9 buracos, 1P e 2P, tacos, recordes locais.
- Botão de música por jogo, separado dos efeitos sonoros.
- Air Hockey: 1P contra IA (3 níveis) e 2P no mesmo aparelho com multitoque; primeiro a 7 gols.
  Testado: 8 testes de física/IA; no navegador, partida contra IA e dois dedos movendo os dois rebatedores ao mesmo tempo.
- Medidor de força novo e igual na sinuca e no golfe (LEDs, taco descendo, disparo animado). Testado por captura de tela.
- Golfe: prévia da direção de saída da tabela na mira (teste automático compara com a física); Zigue-Zague com
  corredores mais largos (média simulada com erro humano caiu de 3,8 para 3,2 tacadas, par 4).
- Personalização: taco por jogador (sinuca e golfe), taco de golfe personalizado, 9 mesas e 5 campos.

- 01/11 noite: IA da sinuca e do hockey recalibrada e medida (Fácil < Médio < Difícil, números no STATUS.md).
  Novos jogos: Duelo de Rastros (com música "Apex Cornering"), Empilha (física planck.js), Lig-4 e Pong.
  Testado: testes automáticos de regras e de níveis de IA de cada jogo + QA no navegador (qa/*.cjs). Não testado no celular.

- 01/11 noite (rodada 4): Torre de Bichinhos com game feel (impacto, faixa de vez, câmera com zoom, física mais
  amortecida e cantos arredondados), Modo Torneio (melhor de 7), Sumô Neon e Cabo de Guerra rítmico.
  Testado: 230+ testes automáticos (regras, IA Fácil < Médio < Difícil, torneio) + QA no navegador (qa/torre-feel,
  qa/torneio, qa/sumo com dois dedos reais, qa/cabo, smoke dos 8 jogos com Shell, i18n, menu, offline). Não testado no celular.

## Próximo
1. Testar no celular (toque, desempenho, sons).
2. Músicas do Empilha, Lig-4 e Pong (pedidos prontos; Leon gera no Gemini).
3. Confirmar termos de uso comercial das músicas geradas no Gemini.
4. Anúncios e app (empacotar como PWA ou app nativo com WebView; loja para os tacos premium).
5. Modo Torneio (sorteia jogos), Snake e Blocos só se o Leon confirmar.

Histórico detalhado da Sinuca: `docs/sinuca/ROADMAP-sinuca.md`.
