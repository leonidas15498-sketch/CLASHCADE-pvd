# Relatório — rodada Clashcade (01/11/2026)

## Comandos executados (todos passaram)
- `npm run typecheck` · `npm run lint` · `npm test` → 17 arquivos, **180 testes** · `npm run build` · `npm run build:single`
- QA no navegador (Chromium automatizado, 915×412 e 390×844), todos com "ERROS: nenhum":
  `menu`, `blocos`, `empilha`, `rastros`, `lig4`, `pong`, `fx-golfe-hockey`, `rastros-tacos`, `efeitos-desligados`,
  `musica-painel`, `smoke-todos`, `i18n-faltando`, `capturas-todos` (scripts em qa/).

## Implementado e testado
| Item | Evidência |
|---|---|
| Menu Clashcade (ref. 01), marca em constante única | qa/menu.cjs (capturas desktop/celular, sem rolagem lateral, botões ≥ 44 px) |
| Placar de sessão Vermelho × Azul (1 vez por partida, só 2P local) | tests/economy + qa/lig4.cjs (vitória 2P → 1 × 0 no menu) |
| Fichas: bônus diário, partidas, 3 desafios; idempotente; relógio para trás não libera | tests/economy (12 testes) + qa/menu.cjs |
| Loja e compra por fichas (2 toques), premium bloqueado fora do teste | tests/economy + qa/menu.cjs (250 → 150 fichas, "✓ Seu") |
| Só o item padrão liberado nos seletores da sinuca/golfe | qa/rastros-tacos.cjs, qa/fx-golfe-hockey.cjs |
| Idiomas pt-BR / inglês (portal + 8 jogos) | qa/i18n-faltando.cjs: telas principais 100% em inglês |
| Torre de Bichinhos: botão SOLTAR, posicionar por toque/arraste, prévia de contato | qa/empilha.cjs (tirar o dedo não solta; toque move; SOLTAR larga) |
| Duelo de Rastros: rastro vetorial pelo trajeto real | tests/trails (trajeto cronológico) + capturas |
| Pong mais lento + IA recalibrada | bench: Fácil 13% / Médio 38% / Difícil 74% dos pontos (10 partidas de 2 min cada, contra robô) |
| Rastros por tempo/distância (sinuca, golfe, pong) | tests/shared/fx (mesmo comprimento a 30 e 120 FPS) |
| 6 jogos com Shell: todos os modos e 3 dificuldades, pausa, reinício, saída limpa | qa/smoke-todos.cjs |
| Painel de volume por cima do jogo | qa/musica-painel.cjs |

## Pendente (não feito ou não comprovado)
- Controle de FPS (Auto/30/60/120) com passo fixo e interpolação em todos os jogos.
- Arte das mesas/tabuleiros dos jogos simples no nível da sinuca; novos bichinhos; capas novas → prompts em docs/arte/prompts-gpt.md.
- Efeitos premium dos tacos (puxar/bater); feedback "Perfeito!" por regra na Torre.
- ≥100 partidas por dificuldade em todos os jogos (hoje 10–200 conforme o jogo); números de IA são de robôs, não de pessoas.
- Teste em celular real (toque, FPS, bateria). Avisos raros da sinuca/golfe podem aparecer em português.
- Marca Clashcade e nomes dos jogos: busca formal de marcas/domínios (docs/marca.md). Termos das músicas do Gemini.
- Anúncios e pagamentos: não implementados (de propósito; flags desligadas).

## Ideias registradas (não iniciadas)
Modos Casual/Normal/Turbo no Pong; conta na nuvem para fichas à prova de fraude; espanhol nos jogos.
