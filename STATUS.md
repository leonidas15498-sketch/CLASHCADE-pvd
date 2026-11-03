# STATUS — Clashcade (nome provisório; antes "Jogaço") — 02/11/2026, 21h30

## V13 (02/11) — recebida do Leon; conferida aqui
- V12/V13 feitas fora desta sessão: ver RELATORIO_IMPLEMENTACAO_CLASHCADE_V12.md e RELATORIO_IMPLEMENTACAO_V13.md.
- V13: ajustes de jogabilidade (Pong, Rastros, Torre, Golfe, Sinuca), filtros na home, Quatro em Linha ONLINE
  (Supabase: src/services/online/, src/games/connect4/online.ts, supabase/migrations/). Config em CONFIGURACAO_SUPABASE.md.
- .env.production tem URL + chave publishable (pública por design; nenhuma chave secreta no código).
- Conferido aqui: npm ci, typecheck, lint, 235 testes (24 arquivos), build OK; build contém a URL do Supabase.
- **Não testado:** se o Supabase responde (rede deste ambiente bloqueia), migração aplicada, Auth anônimo, partida
  online em 2 aparelhos. Botão Online só aparece se o backend responder.
- Sumô: música "The Final Bout" ligada (docs/jogos/sumo.md). Cabo de Guerra segue sem música.
- GitHub: leonidas15498-sketch/CLASHCADE- (raiz do repo = pasta plataforma).

## Rodada 01/11 noite (4): Torre game feel, Torneio, Sumô Neon, Cabo de Guerra — testado (navegador automatizado)
- **Torre de Bichinhos:** tremor 2–4 px/80 ms proporcional ao impulso real (planck post-solve; só batida forte), poeirinha no
  ponto de contato, "toc" seco, faixa "Vez de X" na cor do jogador (e "Esperando a pilha parar…"), câmera com base fixa
  e zoom que afasta aos poucos (QA: pedestal sempre na tela), amortecimento de giro 0,15→1,5 e linear 0→0,1, cantos da
  colisão arredondados (0,05 u). Medição scripts/torre-feel.ts (ANTES=1 = física antiga), cenário controlado de 192 quedas:
  caíram 10→2, estabilização mediana 0,18→0,12 s, máx 5,6→3,8 s, p90 igual (~2,2 s). Turno mediano igual (~1,3 s: é queda
  + 0,45 s parada). Peças por partida "humano" (IA Média) × IA: Fácil 5,1→7,5 · Médio 6,8→9,4 · Difícil 10,7→10,9.
  IA Fácil/Médio recalibradas para a física nova (docs/jogos/empilha.md).
- **Modo Torneio** (src/services/tournament.ts): botão 🏆 no menu, nomes Vermelho/Azul, melhor de 7 (4 vitórias) entre
  7 jogos curtos sorteados sem repetir (Air Hockey, Rastros, Torre, Quatro em Linha, Pong, Sumô, Cabo). Jogo da vez abre
  direto no 2P; empate repete o jogo; resultado conta 1 vez; painel no portal com placar, histórico, "Jogar: X", encerrar.
  Fora: sinuca, golfe, blocos (longos) — reversível em TOURNAMENT_GAMES.
- **Sumô Neon** (docs/jogos/sumo.md) e **Cabo de Guerra rítmico** (docs/jogos/cabo-de-guerra.md): Shell, 1P × IA (3 níveis)
  e 2P simultâneo no mesmo celular (metades da tela; em pé J1 embaixo). IA medida: Sumô Médio>Fácil 88%, Difícil>Médio 68%;
  Cabo Médio>Fácil 100%, Difícil>Médio 100%. Pacotes de música (prompt Gemini) nos docs; `musicUrl: null` até o Leon gerar.
- Corrigido: aviso "+N fichas" disparado depois de sair do jogo dava erro (toast em tela já destruída).
- FPS (qa/fps.cjs, CPU 4×): deitado todos 58–60; em pé Torre 57, Sumô 48, Cabo 59 (Sumô/Cabo eram 30/32 antes de pôr o
  fundo em camada própria). Em pé, outros jogos medidos com a máquina ocupada: refazer isolado se for comparar.
- Testes: 205 passando (21 arquivos); QA sem erros: torre-feel, torneio, sumo (dois dedos reais por CDP), cabo, empilha,
  smoke-todos (8 jogos Shell × modos), i18n-faltando, menu, offline-e-sorteio.
- **Não testado:** celular real (toque, atraso do som no Cabo — fone Bluetooth atrasa; sensação do tremor/zoom), IA contra
  gente (números são robô × robô), músicas dos 2 jogos novos (não existem ainda), Torneio jogado de verdade até o fim
  (QA forçou resultados; regras cobertas por teste unitário).
- Pendentes para o Leon decidir: golfe "repete até alguém errar" (morte súbita × diferença de pontos); metas semanais e
  troca de 1 meta diária grátis; desligar PREMIUM_UNLOCKED_FOR_TESTING antes de abrir ao público.


## Rodada 01/11 noite (3): comparativo 2 Player Games — testado
- Análise do APK em docs/comparativo-2playergames.md (sem descompilar lógica nem copiar conteúdo).
- Aplicado: "Surpreenda-me" no menu, "Outro jogo" no resultado (6 jogos Shell), modo offline PWA (manifest, ícones,
  public/sw.js; registra só em https fora de iframe). QA qa/offline-e-sorteio.cjs: sorteio abre jogo, troca de jogo
  funciona, Pong abre e roda sem internet depois do cache. 189 testes, smoke, i18n e menu sem erros.

## Rodada 01/11 noite (2): golfe hole in one, Torre toque-gira, A/B, FPS — testado
- **Golfe: hole in one possível nos 9 buracos** (scripts/golfe-hole-in-one.ts varre 0,5° × 1% de força; teste
  tests/minigolf/hole-in-one.test.ts confere 1 tacada por buraco + vizinhas). Mudados: buraco 2 (tee 10,26 e buraco 36,12),
  7 (fresta de 3 u em cada bloco, alinhadas; o solver agora faz em 2 tacadas, par 4 mantido), 9 (bloco final 13,5–21 em vez
  de 9–21). Chance de acertar sorteando tacadas: 0,05% (Moinho) a 0,9% (1º buraco).
- **Torre:** toque rápido na tela gira 45°; arrastar move; SOLTAR larga; botão ⟳ escondido.
- **A/B do QA externo (scripts/ab-hockey-pong.ts):** Air Hockey 4,5 m/s derruba os gols para 0,6–1,7/min e deixa Médio
  ≈ Difícil (55% × 54%) → mantido 5,5/5. Pong 0,21 m: Fácil 6%, Difícil 59% (antes 13/74) e trocas mais longas → mantido
  0,18. Nenhum dos dois foi alterado no jogo.
- **FPS (qa/fps.cjs, CPU 4× mais lenta):** Rastros 21→60 e Torre 26–36→60 (fundo estático em camada própria, brilho sem
  shadowBlur, resolução máx. 2× em vez de 2,5× em Pong/Golfe/Rastros/Torre/Air Hockey). Todos 58–60, exceto sinuca 50
  (não mexida: regra do QA "não mudar sinuca sem problema confirmado"). Toda física já era de passo fixo.
- Pendente de decisão do Leon: modo "repete até alguém errar" no golfe; metas semanais/mensais e troca de desafio.

## Rodada 01/11 noite: Pong (raquete) + Torre de Bichinhos (estética) — testado
- **Pong:** raquete de 18 cm MANTIDA após medição (scripts/pong-raquete.ts; números em docs/jogos/pong.md). Toda bola é
  alcançável; partida casual ~2,3 min. Falta: Leon jogar no celular e dizer se defender está fácil (alternativa: 16 cm).
- **Torre:** guia curta que some, sem sombra de onde cai; pedestal/anel da garra pela referência; 6 bichinhos novos;
  celular em pé com zoom maior e botões fora do pedestal.
- **Casca (Shell), todos os jogos:** em tela ≤ 560 px o título some e os placares mostram só bolinha + número
  (antes o título e o placar se sobrepunham no celular em pé).
- Referências de arte do Leon copiadas para docs/arte/referencias-gpt/ (com GUIA_PARA_CLAUDE.md). Ainda NÃO aplicadas:
  air-hockey, pong, quatro-em-linha, blocos, rastros-motos, capas.
- Testes: 180 passando; QA navegador sem erros: empilha, pong, smoke-todos, i18n-faltando (aviso antigo da sinuca segue).

## Rodada 01/11 tarde: BRIEF_MESTRE (Clashcade) — implementado e testado
- **Menu Clashcade** no estilo da referência 01 aprovada: arena navy, logotipo em texto com coroa, placar VS da sessão,
  navegação lateral (Jogos / Loja / Ajustes), painel "Hoje" (bônus + desafios), cartões com botão âmbar. Celular sem rolagem
  lateral; botões ≥ 44 px. Marca em `src/brand.ts` (ver docs/marca.md: NÃO aprovada).
- **Placar de sessão Vermelho × Azul** (src/services/session.ts): só vitória 2P local conta, uma vez por partida; empate,
  IA, solo e abandono não contam; "Nova sessão" não mexe em fichas/recordes. Ligado nos 8 jogos.
- **Economia** (decisão do Leon): só o item padrão de cada categoria vem liberado; Fichas vêm de bônus diário (30), partidas
  concluídas (+5, teto 60/dia) e 3 desafios diários (20/25/35); compram cosméticos "por fichas"; Premium só com a compra
  (hoje `PREMIUM_UNLOCKED_FOR_TESTING = true` para teste). Halloween tem versão por fichas (campo do golfe) e premium
  (mesa, taco, rastro). Catálogo único: src/services/catalog.ts. Loja no menu + compra em 2 toques nos seletores da sinuca
  e do golfe. Tudo local: NÃO é à prova de fraude (não serve para dinheiro).
- **Idiomas pt-BR e inglês** (pedido do Leon): portal, nomes, "Como jogar", menus, pausa, resultados, avisos dos 6 jogos
  com Shell; Sinuca e Minigolfe por tradução do DOM (src/i18n/domTranslate.ts + poolGolfEn.ts). Espanhol: dicionário do
  portal pronto, fora do seletor. QA `qa/i18n-faltando.cjs`: telas percorridas 100% em inglês.
- **Torre de Bichinhos (ex-Empilha)**: botão SOLTAR (soltar o dedo não larga mais); arrastar ou tocar posiciona; Shift
  move fino; sombra de "onde encosta primeiro" por raios na mesma física (não promete estabilidade); arena da referência 02.
- **Duelo de Rastros**: rastro vetorial pelo trajeto cronológico real (antes ligava células vizinhas da mesma cor e podia
  "grudar" trechos paralelos); cantos arredondados só dentro da célula, brilho em camadas; moldura da arena (ref. 03).
- **Pong mais lento**: saque 1,7 m/s, +7%/rebatida, máx. 4,4 m/s, raquete 2,6 m/s, ângulo 55° (o 3,8 m/s do brief
  dava 110–170 rebatidas por ponto entre robôs). IA (vs "humano médio" robô, 10 partidas de 2 min): Fácil 13%,
  Médio 38%, Difícil 74% dos pontos. Rastro da bola por tempo (0,12 s).
- **Rastros por tempo e distância** na sinuca (0,35 s / 1 cm) e no golfe (0,3 s / 0,25 u): mesmo tamanho em qualquer FPS.
- Casca dos 6 jogos (Shell) na paleta Clashcade (navy, botão âmbar). Painel de volume da música por cima do jogo (bug do Leon).
- Testes: 180 (17 arquivos) passando; QA no navegador sem erros: menu, blocos, empilha, rastros, lig4 (inclui placar de
  sessão no menu), pong, fx-golfe-hockey, rastros-tacos, efeitos-desligados, musica-painel, smoke-todos (6 jogos × todos
  os modos e dificuldades, pausa/reinício/saída), i18n-faltando, capturas-todos.

## Pendente desta rodada (não feito)
- Controle de FPS (Auto/30/60/120) com passo fixo + interpolação em todos os jogos.
- Novos bichinhos (urso, panda, raposa, coruja) e feedback "Perfeito!" por regra; arte das mesas/tabuleiros dos jogos
  simples no nível da sinuca → prompts em docs/arte/prompts-gpt.md (aguardando imagens do Leon).
- Efeitos premium dos tacos ao puxar/bater (neon/gelo/ouro).
- Bateria de ≥100 partidas por dificuldade em todos os jogos (hoje 10–200 conforme o jogo).
- Avisos raros dentro da sinuca/golfe podem sair em português se não estiverem no dicionário (o QA cobre as telas principais).
- Celular real: tudo acima foi testado em navegador automatizado, não em aparelho.

## Histórico anterior (Jogaço)

## Pronto e testado (153 testes + QA no navegador sem erros)
- Sinuca 8-Ball, Minigolfe, Air Hockey, Duelo de Rastros, Empilha, Lig-4, Pong.
- 01/11 tarde:
  - Golfe: bola rápida sobre o buraco = som "tin" + aviso "Forte demais!" (só quando sai sem cair). Borda do buraco
    ~30% mais tolerante (expoente 0,35 em sim.ts). Centro igual.
  - Air Hockey: disco máx. 9 → 5,5 m/s (cruza a mesa em ~0,36 s); rebatedor 7 → 5 m/s. Música "Ricochet Velocity"
    (cortada, normalizada a -15 LUFS, ~2 dB abaixo das outras para as batidas aparecerem).
  - Premium cosmético (src/games/shared/fx.ts): rastros (Sombra/Sem rastro grátis; Chama, Neon, Estrelas, Fumaça roxa,
    Morcegos premium) na sinuca (só a branca) e no golfe; aba "Rastro" no Personalizar dos dois.
    Explosão ao encaçapar/cair por tema: Halloween = abóboras + caveiras; Galáxia estrelas; Selva folhas;
    Ouro Negro faíscas; Circuito faíscas vermelhas; Campeonato confete; grátis = simples. Limite 220 partículas;
    "reduzir animações" do aparelho → 35%.

- 01/11 fim da tarde: botões "Taco J1 / Taco J2" no cartão de 2 jogadores (sinuca e golfe) abrem direto o taco de
  cada um. QA `qa/rastros-tacos.cjs`: os 6 rastros nos 2 jogos zeram rastro e partículas depois que a bola para.
  Chama (estava verde-limão no feltro verde), Fumaça (cinza) e Morcegos (pequenos demais) ajustados.

- Interruptor global "Efeito quando a bola cai" (shared/fx.ts, chave jogaco.fx.v1) na aba Rastro da sinuca e do golfe;
  desligado = nenhuma partícula (QA `qa/efeitos-desligados.cjs`). Rastro desliga com "Sem rastro".

- 01/11 noite — **IA recalibrada (item 1 da fila)**. Medição automática: `npx vite-node scripts/bench.ts`
  (funções em tests/bench/, também usadas pelos testes `tests/pool/ai-levels.test.ts` e `tests/airhockey`).
  - Sinuca (60 mesas aleatórias de meio de jogo; partidas IA×IA): Fácil encaça 22% (falta 35%), Médio 43% (15%),
    Difícil 77% (8%), sequência média Difícil 2,4 bolas. Médio vence Fácil 70%; Difícil vence Médio 80%.
    Causa do "burro": erro de mira de 0,85° no Médio (já errava quase tudo) e força sem folga (bola parava antes
    da caçapa). Agora: folga de força, erros 0,85°/0,35°/0,12°, Difícil com jogo de posição (escolhe a tacada que
    deixa a branca com nova bola fácil).
  - Air Hockey (IA nova: sombra na frente do gol, previsão com tabelas, posiciona atrás do disco e tacada; Difícil
    mira o lado aberto e faz tabela). Contra um "humano médio" simulado: IA faz 14% / 41% / 70% dos gols
    (Fácil/Médio/Difícil); defesas de chutes de perto 51% / 95% / 98%; tacada 3,4 / 5,3 / 5,4 m/s.
    O Fácil antes ficava parado na frente do gol, e com o disco a 5,5 m/s isso defendia quase tudo.
  - Suposição: o "humano médio" é um robô com reação de 0,25 s; a sensação real só se confirma jogando.

- 01/11 noite — **Duelo de Rastros (item 2)** jogável: 1P contra IA (3 níveis) e 2P simultâneo (cada um desliza na
  sua metade da tela; teclado WASD/setas). Melhor de 5 rodadas, motos aceleram. Detalhes: docs/jogos/duelo-rastros.md.
  IA medida (rodadas IA×IA, 200 rodadas): Médio vence Fácil 88%, Difícil vence Médio 72% (empates ~22%).
  QA `qa/rastros.cjs`: abre pelo catálogo, deslize vira, 2P (metade direita = J2, tecla W = J1), sair limpa tudo, sem erros.
  Música "Apex Cornering" (Leon) ligada; falta ouvir o loop no aparelho.

- 01/11 noite — **Empilha (item 3)** jogável e no catálogo no lugar da Torre Perfeita: solo (recorde), 1P contra IA, 2P por
  turnos. Física com planck.js (decisão e custo em docs/jogos/empilha.md). IA medida: sozinha empilha
  Fácil 3–5 / Médio ~9 / Difícil ~13 peças (16 pilhas cada, limite 25). Difícil vence Médio 94% (16 partidas);
  Médio vence Fácil 67% (30 partidas) — em pilha
  compartilhada a sorte da peça pesa e quem herda uma pilha torta sofre; isso é do jogo.
  QA `qa/empilha.cjs`: arrastar/soltar, cair da mesa encerra, IA Difícil joga em ~1 s sem travar a tela, sem erros.

- 01/11 noite — **Lig-4 (item 4)**: 1P contra IA e 2P por turnos; revanche alterna quem começa. Detalhes em docs/jogos/lig-4.md.
  IA medida (40 partidas por par, alternando quem começa): Fácil faz 95% dos pontos contra jogadas aleatórias;
  Médio 95% contra Fácil; Difícil 76% contra Médio. QA `qa/lig4.cjs`: clique derruba a peça, IA responde em ~1,3 s
  depois da queda, 2P até a vitória (linha marcada, resultado, revanche troca quem começa), sem erros.

- 01/11 noite — **Pong (item 5)**: 1P contra IA e 2P simultâneo, primeiro a 7. Reaproveita mesa, passo, controles e o
  modelo de IA do Air Hockey (docs/jogos/pong.md). IA medida contra o "humano médio" simulado (10 partidas de 2 min):
  Fácil faz 10% dos pontos, Médio 52%, Difícil 82%. QA `qa/pong.cjs`: raquete segue o dedo, pontos contam, 2P por metade
  da tela e teclado, sem erros. Rodados de novo no fim: 153 testes, build, QA de rastros, empilha, lig4 e sinuca/golfe/hockey.

- 01/11 15h40 — **Blocos Cromáticos (fase 3 da especificação JOGACO_EXPANSAO)** jogável: 1P com recorde e 2P (um depois do outro).
  Grade 8×8, 3 peças, combo até ×5 (tolera 2 jogadas sem limpar), bônus de grade limpa, faixas Bronze/Prata/Ouro/Diamante
  calibradas por robôs (docs/jogos/blocos.md). Música "Seven Blue Tiles" (110 BPM, 72 compassos, -14,4 LUFS).
  167 testes; QA `qa/blocos.cjs` em paisagem e retrato sem erros; regressão dos outros QA sem erros.
- 01/11 — **Corrigido: painel de volume da música ficava atrás da mesa** (relato do Leon na sinuca). Causa: cabeçalho e área do
  jogo com o mesmo z-index; a mesa, vindo depois, cobria o painel. Cabeçalho subiu para z-index 3 na sinuca, golfe e Shell
  (todos os jogos). QA `qa/musica-painel.cjs`: sinuca, golfe, hockey, blocos e empilha OK; com o valor antigo o teste falha.

## Não testado
- Celular real (toque, FPS), escuta do loop da música do hockey, sensação da nova velocidade do hockey.
- Sensação dos novos níveis de IA jogando de verdade (sinuca e hockey).
- Pong e Lig-4 no celular (sensação da velocidade da bola; tamanho das colunas para o dedo).
- Empilha no celular (arrastar com o dedo, tamanho das peças, se o Difícil é justo).
- Blocos no celular: arrastar com o dedo (a peça sobe acima do dedo), tamanho das peças na bandeja, se as faixas são justas.
- Duelo de Rastros com duas pessoas no mesmo celular (dois dedos ao mesmo tempo) e se a velocidade está boa.

## Próximo (fila de 01/11 concluída: IA, Duelo de Rastros, Empilha, Lig-4, Pong)
1. Leon: jogar no celular e dizer se os níveis de IA "batem" com o nome (números acima são de robôs).
2. ~~Músicas~~ (todas ligadas em 01/11). Site gerado para o Cloudflare (pasta dist).
3. Cloudflare, teste com outras pessoas, polimento visual. Ideia futura: modo Torneio (sorteia jogos).
- **Próxima fase (pedido do Leon, 01/11 15h):** jogo de blocos estilo Block Blast (nome e arte próprios: "Block Blast"
  é marca de outra empresa), com recorde pessoal, faixas de pontuação e multiplicador (combo) bem calculados; economia
  de moedas: login diário + missões diárias; TUDO desbloqueável com moedas (rastros, tacos, mesas, campos, cores),
  só os itens padrão já liberados; depois, anúncio que libera item por 1 dia. Pontuação justa para os jogos que têm pontos.
  Decisões em aberto: ranking de amigos exige login e servidor (hoje fora de escopo no CLAUDE.md); moedas só no aparelho
  (localStorage) são fáceis de burlar e somem ao limpar dados; os itens "premium" atuais viram itens por moeda?
- Fora por ora: Snake (repete o Duelo de Rastros).
- Proposta de modelo premium (a decidir): compra única "Jogaço sem anúncios" libera todos os itens premium de todos
  os jogos; passe/assinatura só se houver conteúdo novo frequente.

## Músicas (todas do Leon, Gemini; cortadas em compassos inteiros pelo andamento medido, loop com fade de 2,5 s)
- Sinuca "Midnight Felt", Golfe "Sunday on the Velvet Green", Hockey "Ricochet Velocity" (-15 LUFS),
  Duelo "Apex Cornering" (124 BPM, 86 compassos, -15), Empilha "Sunny Stacks" (saiu a 120 BPM, não 96; intro de 4 s
  cortada; 83 compassos, -14), Lig-4 "Calculated Gambit" (104 BPM, 65 compassos, -14), Pong "Center Court Rally"
  (120 BPM, 80 compassos, -15). Falta ouvir as emendas do loop no aparelho.

## Pendências do Leon
- Oceânica: no código é grátis; na imagem de referência aparece como premium. Decidir.
- Moldura decorada (abóbora, castiçais) da imagem de referência: avaliar sem tapar caçapas.
- Snake: entra ou não? (Blocos entrou em 01/11.)
- GitHub (repositório `jogaco`) para parar de trocar zip.

Link de teste: artifact "Jogaço" — claude.ai/artifact/MtPsq8dEeoho2YdK82fcSX (versão 11, 01/11 22h: Torre game feel, Torneio, Sumô, Cabo de Guerra).
