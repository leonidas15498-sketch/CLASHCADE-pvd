# CLAUDE.md — regras estáveis do projeto

## Escopo fixo (plataforma "Clashcade" — nome provisório, antes "Jogaço"; marca em src/brand.ts, ver docs/marca.md)
- Portal web de minijogos locais: catálogo → jogo → modalidade → partida → resultado → revanche/menu.
- Jogos disponíveis (10): Sinuca 8-Ball (1P vs IA, 2P local), Minigolfe (1P, 2P local por turnos), Air Hockey (1P vs IA, 2P local simultâneo),
  Duelo de Rastros (1P vs IA, 2P local simultâneo) Torre de Bichinhos, ex-Empilha (solo, 1P vs IA, 2P por turnos; física planck.js),
  Quatro em Linha, ex-Lig-4 (1P vs IA, 2P por turnos), Pong (1P vs IA, 2P local simultâneo) e Blocos Cromáticos (1P recorde, 2P um após o outro), Sumô Neon e Cabo de Guerra rítmico (1P vs IA, 2P simultâneo). Padrão para jogo novo: docs/jogos/_padrao.md.
- **Modo Torneio (01/11):** melhor de 7 entre jogos curtos sorteados (src/services/tournament.ts, lista TOURNAMENT_GAMES;
  sinuca, golfe e blocos fora por serem longos). O Shell abre o jogo da vez direto no 2P e registra o resultado; empate repete o jogo.
  Jogo novo com 2P local curto: incluir em TOURNAMENT_GAMES.
- Próximos passos: fila no STATUS.md.
- Fora de escopo nesta etapa: login, ranking global, Supabase, anúncios, multiplayer online, APIs pagas, compras reais.
- **Economia (decisão do Leon, 01/11):** só o padrão liberado; Fichas (bônus diário, partidas, desafios) compram itens 'coins';
  'premium' só com a compra do Premium (que também tira anúncios); sazonais podem ter versão por fichas e premium.
  Catálogo único src/services/catalog.ts; toda concessão idempotente (src/services/economy.ts). Cosmético nunca muda física.
- **Fim de partida:** Shell games chamam `shell.beginMatch()` no início e `shell.report(cfg, vencedor)` no fim; sinuca/golfe
  chamam reportMatch (src/services/match.ts). Partida abandonada nunca é relatada.
- **Idiomas:** pt-BR e en-US. Nos jogos: `T(pt, en)` de src/i18n/lang.ts; sinuca/golfe: dicionário em src/i18n/poolGolfEn.ts.
  Texto novo sempre nos dois idiomas; rodar qa/i18n-faltando.cjs.
- Resultados de 2P local nunca alimentam rankings; só histórico/recordes locais.

## Regras da plataforma
- React + TS + Vite. O portal (src/app, src/pages, src/components) é React; cada jogo é um módulo imperativo
  com `mount(container, {onExit}) → {destroy}` (src/games/shared/types.ts), carregado sob demanda pelo registro
  (src/games/registry.ts). Rotas pelo hash (#sinuca, #minigolfe) — sem recarregar a página.
- `destroy()` precisa parar laço de animação, áudio, timers e listeners globais (AbortController) e remover o
  CSS do jogo (injetado via `?inline`). Há teste de vazamento no TEST_REPORT.
- Falha em um jogo não derruba o portal (error boundary + tela de erro com "Voltar aos jogos").
- Cada jogo tem SUA música e um botão de música próprio (liga/desliga + volume), separado dos efeitos sonoros
  (src/games/shared/musicControl.ts). Sinuca: "Midnight Felt"; Minigolfe: "Sunday on the Velvet Green"; Air Hockey: "Ricochet Velocity"; Duelo de Rastros: "Apex Cornering";
  Empilha: "Sunny Stacks"; Lig-4: "Calculated Gambit"; Pong: "Center Court Rally"; Blocos: "Seven Blue Tiles" (todas do Leon).
- **Música de jogo novo:** seguir docs/jogos/musica.md (direção musical do Leon: pacote com conceito, prompt, justificativa,
  critérios de aprovação e loop/volume).
- Persistência: src/services/storage.ts (versão de esquema + validação; interface RemoteSync para o futuro).
- **Padrão de cores (pedido do Leon):** Jogador 1 = coral #ff6b4a, Jogador 2 (ou IA) = azul #3d8bff, em TODOS os jogos
  (src/games/shared/players.ts). O fundo da tela fica na cor de quem joga (variável CSS --turn via setTurnColor).
- **Padrão de força (pedido do Leon):** barra lateral com o taco/instrumento desenhado: puxar para baixo = força,
  soltar = joga, voltar ao topo = cancela; e o mesmo gesto direto no campo (pegar o taco atrás da bola). Sem botão
  "Tacar". Tocar à frente da bola mira no ponto. Durante a puxada a direção trava.
- **Medidor de força único** (src/games/shared/powerGauge.ts): tubo com moldura metálica, LEDs verde→âmbar→vermelho,
  o taco do jogador desce na puxada e dispara para cima ao tacar (clarão + onda). Todos os jogos com força usam este.
- **Personalização (pedido do Leon, 01/11):** cada jogador tem o seu taco (sinuca e golfe); golfe tem taco
  "Personalizado" (cabeça, haste, punho); temas de mesa (src/games/pool/game/tables.ts) e de campo
  (src/games/minigolf/render/courses.ts) desenhados pelo próprio renderizador — nunca filtro CSS sobre o canvas
  (filtro muda a cor das bolas). Só visual: física e regras iguais.
- Cabeçalho (HUD) sempre com z-index acima da área do jogo, senão o painel de volume da música fica atrás (bug de 01/11).
- Jogos novos usam o Shell compartilhado (src/games/shared/shell.ts): menu, pausa, ajuda, resultado, cores, música.
- **Itens premium:** liberados para TESTE pela chave PREMIUM_UNLOCKED_FOR_TESTING (src/games/shared/flags.ts).
  Antes de publicar na loja: mudar para false.

- **Rastros e explosões (01/11):** src/games/shared/fx.ts. Rastro = item do jogador; explosão = do tema da mesa/campo
  (campo `burst`). Só visual, desenhado no canvas, limite de partículas. Novos jogos reutilizam este módulo.

## Decisões aprovadas / tomadas
1. **Stack: Vite + TypeScript + Canvas 2D nativo + DOM simples** (desvio consciente da sugestão Phaser + React).
   Motivo: o jogo é uma única cena 2D desenhada à mão e a física é própria; Phaser traria cena, loader e
   física que não seriam usados (~1 MB) e React seria só para ~10 elementos de HUD. Resultado: bundle de ~46 KB,
   menos camadas e menos pontos de falha.
2. Física em `src/games/pool/physics/` sem nenhuma dependência de DOM/Canvas. Unidades SI (m, s). Passo fixo 1/120 s.
3. A guia de mira usa a MESMA geometria do motor (círculos de raio 2R e cápsulas de raio R) e mostra apenas o
   trecho reto da branca até o primeiro contato. Exceção (pedido do Leon, 03/11): **linha guia opcional**
   (Configurações → "Linha guia", padrão ligada, salva por aparelho) mostra a saída da bola atingida até o primeiro
   contato dela (objectBallPath). É exata porque o contato bola-bola é sem atrito e a normal é calculada no instante
   do contato (tests/pool/guide.test.ts, erro < 0,1°). Nunca desenhar a branca depois do choque nem tabelas seguintes.
4. Tacada = um único impulso; o ponto de batida (efeito) gera giro pela física real (r × impulso / I).
   Modelo: deslizamento → rolamento, giro vertical com atrito, contato bola-bola sem atrito, efeito lateral na tabela.
   Sem massé e sem desvio da branca (squirt). IA sempre bate no centro.
5. Regras: variante baseada na WPA com simplificações documentadas em `RULES.md` e mostradas em "Como jogar".
6. IA usa as mesmas funções `shoot`/`placeCue` do humano; pode simular a física (mesmo motor) para avaliar
   candidatas, mas o disparo final recebe erro angular/força por dificuldade.
7. Controle de mira: tocar/clicar em qualquer ponto da mesa aponta o taco; botões de ajuste fino.
8. Tacada (pedido do Leon, 01/11): a barra lateral é um taco desenhado — puxar para baixo define a força e soltar taca.
   Voltar ao topo antes de soltar cancela. Substituiu o botão TACAR.
9. HUD: anel de tempo em volta da foto de quem joga (padrão 45 s; estourar = falta com bola na mão), relógio da partida,
   bolas do grupo de cada jogador (apagadas = já caíram), faixa com todas as encaçapadas.
10. Bola errada na mira: linha vermelha + X sobre a bola (sem destacar número — pedido do Leon).
11. Bolas desenhadas como esferas pixel a pixel a partir do quatérnio integrado pela física (número e faixa giram).
    Física recalibrada pelos valores medidos de sinuca real (ver PHYSICS.md): rolamento 0,12 m/s², arrasto 0,02/s,
    μ deslizamento 0,2, tabela 0,82, abertura 9 m/s. Não mexer nesses números sem medir de novo.
12. Bola encaçapada: cai na boca (encolhe e escurece) e desce rolando pela canaleta à direita da mesa, empilhando
    na ordem em que caiu. Placar usa ícones das bolas desenhados pelo mesmo pintor 3D. Animação só visual (`pocketFx.ts`).

13. Mira pelo taco (pedido do Leon): tocar atrás da branca gira o taco em volta dela (rotação relativa); se o toque
    pegar no taco, puxar para trás dá força (0,42 m = 100%) e soltar taca; voltar à branca cancela. Tocar à frente
    mira direto no ponto. Durante a puxada a direção trava.
14. Tacos: catálogo em `src/games/pool/game/cues.ts`, todos com a MESMA física. Premium bloqueados ("em breve na loja do app")
    até existir compra real; nada de compra simulada.

15. Música de fundo "Midnight Felt" (feita pelo Leon no Gemini): `public/music/midnight-felt.mp3`, cortada no silêncio
    final e regravada a 128 kbps. Loop com fade cruzado de 2,5 s (WebAudio); fallback `<audio loop>`. Só toca após
    um toque, pausa com a aba escondida. Botão de música próprio (nota musical) com liga/desliga e volume; o botão de
    alto-falante controla só os efeitos sonoros.
    Pendente: confirmar os termos de uso comercial do Google para músicas geradas no Gemini antes de monetizar.

16. Caçapa (pedido do Leon, 01/11): área de queda = buraco desenhado (canto 6,0 cm, lateral 5,5 cm de raio a partir
    do centro da caçapa). Se o centro da bola passa sobre o preto, ela cai.

## Minigolfe — regras permanentes (derivadas da especificação em docs/proximas-etapas/minigolfe-prompt.md)
- Física e regras em TS puro (src/games/minigolf/physics, rules, levels); render em Canvas 2D (render/), UI em ui/.
- Mesmo simulador para o movimento e para a linha de mira (cápsulas); a linha vai só até o 1º contato ou 20 u.
- Fora de campo = +1 tacada e volta ao último ponto seguro. Limite 10 tacadas por buraco (teto inclui penalidade).
- 2P: tacadas alternadas, quem terminou é pulado; menor total vence; empate → 3 últimos buracos → empate.
- Rampas só com aceleração coerente (zona com vetor de aceleração). Cada buraco tem `route` para o teste de solução.
- Mira mostra, além da linha até o 1º toque, uma prévia curta (9 u) da direção de saída da tabela, calculada com a
  mesma regra da colisão (teste em tests/minigolf/customize.test.ts). Pedido do Leon: fases com tabela estavam difíceis.
- Força: padrão da plataforma (puxar e soltar). v = 27·√força → distância proporcional à força (100% ≈ 61 u).
- Desaceleração quase constante 6 u/s² (sem freio proporcional à velocidade) — calibrado em 01/11.
- Captura no buraco: limite = 13,5·(1−(d/R)²)^0,35 u/s. Evento `lip` só quando a bola sai do buraco sem cair
  (som + aviso "Forte demais!").
- Air Hockey: disco máx. 5,5 m/s, rebatedor 5 m/s (01/11; antes 9 e 7, rápido demais no celular).

## Próximas etapas registradas
- Anúncios e app (fora do escopo atual). Snake e Blocos (ideia vinda
  da versão do GPT, a reconstruir como módulos do Shell se o Leon confirmar).
- Versão do GPT (01/11) analisada: aproveitado o conceito (personalização, temas, taco por jogador); descartado o método
  (scripts colados no arquivo final clicando em botões escondidos, filtros CSS, efeito de caçapa sorteada, capas com
  telas que não existem).

- **IA medida (01/11):** cada nível tem número registrado (tests/bench/, `npx vite-node scripts/bench.ts`) e teste que
  garante Fácil < Médio < Difícil com folga. Mudou IA ou física → rodar o bench e atualizar o STATUS.

## Regras de trabalho
- Não declarar algo pronto sem testar; registrar no ROADMAP o que foi testado de fato.
- Não misturar física com renderização. Não refazer módulos inteiros sem necessidade.
- Rodar `npm run typecheck && npm run lint && npm test && npm run build` antes de entregar.
