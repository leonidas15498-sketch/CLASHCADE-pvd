# STATUS — Clashcade (nome provisório; antes "Jogaço") — 02/11/2026, 21h30

## Publicação (02/11, 22h15)
- Repositório OFICIAL: leonidas15498-sketch/CLASHCADE-pvd (Cloudflare Worker "clashcade-pvd" publica a cada push na main).
  CLASHCADE- vira backup (copiar só nos marcos). wrangler.jsonc roda `npm run build` e publica só dist/ (sem código-fonte).
- Deploy da V13 na Cloudflare: Success (confirmado pelo Leon).
- Supabase (projeto tgybollzkrnnndvzqjoi): migração já aplicada; conferido no SQL Editor: protocolo 1, função do jogo,
  RLS e Realtime OK. Login anônimo ligado.
- **Quatro em Linha online TESTADO pelo Leon em 2 aparelhos (02/11 22h30): funcionou.** Depois disso: peça cai animada
  no online e revanche com "Pedir/Aceitar revanche" (commit 3bcc640; revanche nova ainda não testada no aparelho).
- **Próximo (decisão do Leon: levar outros jogos ao online).** Ordem recomendada:
  1. Sinuca online (por turnos; quem taca simula e envia posições finais; servidor valida vez/versão; mesmo padrão de sala
     do Quatro em Linha, generalizado para vários jogos).
  2. Minigolfe e Torre (mesmo modelo). 3. Pong como piloto de tempo real (medir atraso antes de Air Hockey/Rastros/Sumô/Cabo).
  4. Blocos: desafio assíncrono (mesma semente). Conferir limites do plano grátis do Supabase Realtime antes do tempo real.

## PRÓXIMO (pedido do Leon, 03/11 20h49) — fazer em conversa nova
1. **Loja dentro de cada jogo:** cada jogo com a SUA loja (só os itens dele: tacos, mesas, rastros...), aberta por um botão
   no menu do próprio jogo, como menu à parte. Hoje a loja é geral no portal (src/services/catalog.ts, shopUi.ts).
   Manter Fichas/Premium e a economia como estão (catálogo único; só muda onde e como aparece).
2. **Menus mais intuitivos** de forma geral (portal e menus dos jogos). Levantar o fluxo atual com capturas antes de mudar.
3. Mesa da sinuca "esticada" na horizontal: NÃO feito de propósito. Esticar só na largura deixa as bolas ovais e muda a
   física; o limite é a altura do celular. Já feito: layout compacto (+23%) e tela cheia. Leon ainda vai avaliar a versão
   de 20h48. Se quiser mais: diminuir a madeira da mesa no modo compacto (~+6% de feltro).
4. Telas dos outros jogos no celular (pedido de 02/11), usando o mesmo método de medição (Playwright 732×276 e 762×343).
   Tela cheia já feita em todos (03/11 21h); falta compactar cabeçalho/laterais onde sobrar espaço (qa/tela-cheia.cjs mede).

## Air Hockey mais lento, Pong conferido, prompts de arte (03/11, 21h30) — testado por robôs; FALTA celular real
- **Air Hockey (Leon: rápido demais, peças pequenas):** disco 5,5 → 5,0 m/s (cruza a mesa em 0,40 s; antes 0,36),
  raio do disco 0,040 → 0,044, rebatedor 0,065 → 0,070 (~37 px no celular deitado), gol 0,34 → 0,46 para compensar.
  IA Difícil: rebatedor 0,75 → 0,85 da velocidade, reação 0,14 → 0,12 s (sem isso empatava 50% com o "humano médio").
  Bench: IA faz 9% / 33% / 64% dos gols (antes 15 / 41 / 65); ordem dos níveis mantida (teste passa).
  ATENÇÃO: entre robôs, gols por minuto caem bastante com disco mais lento (Médio 4,1 → ~0,7–1,1). O robô de referência
  defende ~95%, bem mais que gente no celular, então o número real deve ser maior — conferir jogando. Se a partida ficar
  longa: reduzir goalsToWin 7 → 5. Medidas de todas as combinações: scripts/ab-hockey-tamanho.ts (ex.: 4,2 m/s + peças
  grandes = 0,1 gol/min, empate eterno; por isso a redução foi pequena).
- **Pong (Leon: conferir hitbox):** a colisão é exatamente a raquete desenhada + raio da bola. Teste novo em
  tests/pong/pong.test.ts: rebate a 1 mm dentro da ponta e passa a 1 mm fora. Nada mudado. Se parecer "atravessar", a causa
  provável é a raquete seguir o dedo com velocidade máxima 2,6 m/s (atraso visível em movimentos rápidos) — avaliar no celular.
- **Prompts de arte (rodada 2):** docs/arte/prompts-gpt-2.md — portal, menu de jogo padrão, loja dentro do jogo (sinuca e
  air hockey), Sumô (lutadores e ringue), Cabo de Guerra, capas que faltam, temas de mesa/quadra para a loja.
- Fila (Leon 03/11 21h29): estética primeiro (com as referências do GPT); lojas por jogo já incluem personalizar mesa
  (Air Hockey, Pong etc.); mais fases do golfe ficam para um segundo momento (as 9 atuais bastam por enquanto).

## Online ao vivo, aviso da 8 e tela cheia em todos os jogos (03/11, 21h) — testado localmente; FALTA celular real
- **Relógio online:** aparece sempre (45 s da sala, mesmo com "sem limite" nas Configurações) e também na vez do outro.
  Antes o anel usava a preferência local (sem limite = escondido) e só contava na minha vez.
- **Mira ao vivo:** na vez do outro, vejo o taco, a linha de mira, a força puxada e a branca (bola na mão) dele, sem poder
  mexer. Vai por Realtime *broadcast* (mensagem efêmera, não grava no banco, sem SQL novo), ~11 msgs/s no máximo, só
  quando muda; o outro suaviza o movimento. QA 2 navegadores: ângulo recebido 0,300/0,800/−0,499 (enviado 0,3/0,8/−0,5),
  "pode mexer: false", mesas idênticas 4/4. NÃO testado no Supabase real: se o projeto estiver com "só canais privados"
  no Realtime, o broadcast não chega (a partida continua funcionando, só sem a mira ao vivo).
- **Linha guia (conferido):** 4 traços, 5,4 raios ≈ 15 cm (GUIDE_DASHES=4 no renderer). Rastro da bola: 0,35 s (não mudou).
- **Aviso "Cante a caçapa da bola 8"** (todos os modos; online só para quem joga): cartão amarelo no meio da mesa por 1,9 s,
  depois voa até a linha de status (que pisca e mantém o lembrete); some ao tocar a caçapa. Não bloqueia o toque.
  QA qa/sinuca-bola8.cjs (2P 915×412 e IA 732×276).
- **Tela cheia no celular em TODOS os jogos** (pedido do Leon: "igual à sinuca"): Shell (8 jogos) e Minigolfe entram em tela
  cheia ao começar a partida e saem ao voltar. QA qa/tela-cheia.cjs (celular simulado 762×343): 10/10 entram e saem.
  Não inclui o layout compacto da sinuca (cabeçalho/laterais menores) — isso é o item 4 do PRÓXIMO, jogo a jogo.
- Testes: 251 passando; smoke-todos sem erro de código.

## Sinuca: online quase simultâneo + linha guia (03/11, 20h) — testado localmente; FALTA testar em 2 celulares
- Pedido do Leon: o outro celular só via a tacada depois que as bolas paravam no aparelho de quem tacou (~6 s parado).
  Agora quem taca calcula o fim da tacada numa cópia, na hora (GameController.predictOutcome, poucos ms), e envia já
  no impulso; o outro começa a animar logo. QA com 2 navegadores (qa/sinuca-online.cjs): atraso 27–168 ms sem internet
  (antes = tempo de rolagem, 5,8–6,6 s); mesas idênticas 4/4. Na rede real soma o tempo do Supabase (estimativa 0,2–0,6 s).
  Sem SQL novo. Se a jogada seguinte chegar enquanto a minha ainda anima, é aplicada no fim dela.
- Linha guia opcional (Configurações → "Linha guia", padrão ligada, por aparelho; vale contra IA, 2P e online):
  início da saída da bola atingida, 4 traços fixos (~17 cm), sem círculo (ajuste do Leon às 20h41: estava longa demais). Para ser exata, a física passou a calcular a normal do choque
  bola-bola no instante do contato (antes usava a posição já sobreposta: cortes saíam até 1,3° tortos).
  tests/pool/guide.test.ts mede erro < 0,1°. Bench da IA depois da mudança: encaçapa 25% / 47% / 80%, falta 35% / 17% / 5%
  (antes 22/43/77 e 35/15/8); ordem dos níveis mantida.
- Celular deitado (pedido do Leon): cabeçalho compacto, laterais estreitas, faixa de mensagem flutuando sobre a madeira
  (some 3 s depois da mensagem). Medido em 732×276 (Chrome com barra): mesa 363×190 → 447×234 px (+23%); em 762×343
  (sem barra): 491×257 → 566×296. Partida no celular entra em tela cheia (src/games/shared/fullscreen.ts; não no iPhone/app).
  Versão do site aparece no fim de Configurações (para conferir se o celular atualizou).
- Botão "Copiar código" (bug do Leon): no Android o aviso de cópia tirava o foco e pausava; online não pausa mais sozinho.
  Cópia com 3 tentativas (Clipboard API → seleção+copiar → compartilhar); se tudo falhar, mostra o código na barra.
- Limitação: no online cada jogador escolhe a linha no próprio aparelho (não é regra da sala).

## Sinuca online (02/11, 23h) — implementado e testado localmente; FALTA aplicar o SQL e testar em 2 aparelhos
- Salas generalizadas para vários jogos: migração NOVA `supabase/migrations/20261103010000_clashcade_rooms_multigame.sql`
  (colunas `game`, `state`, `turn_started`; função com `p_game`/`p_payload`; protocolo 1 → 2). Ordem: SQL antes, depois deploy.
  Enquanto o SQL não for aplicado, o site novo ESCONDE o Online (inclusive do Quatro em Linha): protocolo ≠ 2.
- Sinuca: quem taca simula no próprio aparelho e envia mesa final + mesa antes do impulso + velocidades da branca;
  o outro repete a física só para animar e no fim usa o estado recebido. Servidor confere vez, versão, rodada, forma e
  tamanho (≤ 20 KB), tempo esgotado (quem joga: 35 s; o outro reivindica após 55 s; cliente usa 45 s e 62 s) e placar.
  NÃO revalida a física (cliente adulterado pode mentir): ok para sala entre amigos, não para ranking.
- Código: src/services/online/roomLobby.ts (janela + barra genéricas), src/games/pool/online.ts (estado),
  GameController.replayShot, app.ts (seção "online"). Online não conta placar de sessão, fichas nem estatísticas.
- Testado: 246 testes (inclui 7 de SQL multijogo em PGlite e 4 de repetição da tacada: diferença 0 m);
  QA `qa/sinuca-online.cjs` (2 navegadores + SQL real em PGlite): criar/entrar, 4 tacadas com mesas idênticas,
  só um taca, tempo esgotado reivindicado, fim, revanche (abre o outro), sair → "Sala encerrada", 2P local depois.
  smoke-todos, i18n-faltando, lig4, rastros-tacos sem erros (só falha de rede ao Supabase, bloqueado nesta máquina).
- **Não testado:** Supabase hospedado (Realtime/Auth), 2 celulares reais, iPhone × Android (Math.sin/cos podem
  diferir no último dígito: a animação pode divergir; o estado final é sempre o de quem tacou — encaixa no fim).
  O adversário não vê a mira ao vivo, só a tacada.
- Pedidos do Leon (22:45–22:54): (1) FEITO: avanço do Sumô também em Q/E/F/Shift esq. (J1) e Shift dir./0 (J2), testado.
  (2) Sumô "sem música": no código a música toca (QA: buffer de 113 s iniciado, arquivo servido). Cabo de Guerra é que
  não tem música (musicUrl null). Confirmar com o Leon qual jogo e se não era chamada telefônica/cache antigo.
  (3) PRÓXIMO: jogos maiores no celular — em pé a mesa da sinuca/campo do golfe fica minúsculo (mesa deitada numa tela alta);
  plano: girar mesa/campo 90° em pé (render + toque) e enxugar o HUD da sinuca em pé (textos sobrepostos).

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
