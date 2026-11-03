# TEST_REPORT — 01/11/2026

## Automatizado (Vitest, sem navegador) — 97 testes, 7 arquivos, todos passando
- `npm run typecheck`, `npm run lint` e `npm run build` sem erros.
- **Sinuca (59):** física, efeito, caçapas (inclui 2 novos: área de queda = buraco desenhado), regras 8-ball,
  tempo esgotado, IA (partidas completas IA×IA nos 3 níveis), animação das encaçapadas.
- **Minigolfe — física (11):** desaceleração e parada sem tremor; tacada bloqueada com bola em movimento;
  quique em 8 ângulos sem atravessar; velocidade máxima no canto; cair devagar / passar por cima rápido;
  sem sucção à distância; água = fora; rampa (fraca volta, forte passa); obstáculo móvel transmite velocidade;
  linha de mira para no mesmo ponto em que a bola toca o bloco; determinismo.
- **Minigolfe — regras (8):** contagem, ponto seguro, penalidade, teto de 10 (com penalidade), alternância 2P e
  pular quem terminou, vitória por total, desempate pelos 3 últimos, empate, fim após o 9º buraco.
- **Minigolfe — fases (19):** 9 fases com nomes diferentes; saída e buraco dentro do gramado e longe de paredes;
  **cada buraco resolvido por busca automática** (1, 2, 2, 1, 1, 2, 3, 1, 2 tacadas).

## Navegador (Chrome headless, 844×390 com toque e 1366×800)
- Catálogo nas duas telas; entrar e sair da Sinuca e do Minigolfe pelo botão "← Jogos" e pelo voltar do navegador.
- **Vazamento:** 8 entradas/saídas seguidas → listeners globais iguais ao início (2 → 2), nenhum CSS de jogo
  sobrando e 0 quadros de animação pedidos no catálogo depois de sair.
- **Minigolfe 1P:** rodada completa de 9 buracos pela interface (botão Tacar), placar, recorde salvo e mostrado
  no menu, revanche zera, sair com confirmação.
- **Minigolfe 2P:** partida completa de 9 buracos alternando jogadores; terminou empatada no total e foi decidida
  pelos 3 últimos buracos (caso real, não forçado); revanche e saída.
- **Minigolfe:** bola na água → volta ao ponto seguro com +1 e aviso; segunda tacada com a bola rolando recusada
  (botão desabilitado); escolha de taco salva.
- **Sinuca no portal:** mira pelo taco, puxar e soltar, tacos, queda na caçapa e canaleta, tempo/pausa;
  botão de música: desliga só a música (efeitos continuam), volume salvo.
- Nenhum erro de JavaScript em nenhum desses roteiros.

## Observações honestas
- As tacadas "humanas" do QA foram calculadas pela busca automática e executadas pelos botões da interface.
- Não testado em celular físico nem no Safari/iPhone. Sons e música não foram ouvidos por uma pessoa.
- O botão "voltar" do navegador sai do jogo sem pedir confirmação.
