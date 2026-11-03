# Comparativo: 2 Player Games: The Challenge (JindoBlu) × Clashcade — 01/11/2026
Fonte: APK enviado pelo Leon (99 MB), lido como pacote: lista de bibliotecas, assemblies e nomes de classes do
`global-metadata.dat` (Unity IL2CPP). NÃO foi descompilada lógica de jogo nem copiado código, arte ou som
(é conteúdo protegido; e a lógica fica compilada em código nativo no libil2cpp.so). Não foi executado em emulador.

## Como o app funciona (pelo que o pacote mostra)
- Motor: Unity com IL2CPP (C# compilado para nativo), 1 cena-menu e minijogos como controladores separados.
- ~30 minijogos identificados por classe: Soccer, Carrom, Backgammon, Ludo, Mancala, Mill (trilha), DotsBoxes,
  RockPaperScissors, HotPotato, KnifeHit, Lumberjack, CrazyTaxi, FlappyDunk/Hoops, HappyBirds, Saber, Spikes, PopIt,
  TapMatch, Memory, Math, Sudoku, Solitaire, Mahjong, Yazy (Yahtzee), SlidingPuzzle, BlockPuzzle, BallWater, Duell.
  Muitos são de tabuleiro/cartas (baratos de fazer) e reflexo de 1 toque (partidas de segundos).
- Recursos: placar por jogador (scoreAllTime, dailyScores), Torneio (Tournament, TournamentInterval/Result),
  botão de jogo aleatório (RandomButtonClicked), "jogar o próximo" (PlayNextGame), IA com Fácil/Médio/Difícil
  (EasyGame/MediumGame/HardGame), modo online (OnlineManager, checagem de conexão antes/durante a partida),
  notificações locais.
- Monetização: jogos Premium (PremiumGame, premiumBadge) que podem ser liberados de graça (premiumForFree) — indício
  de "assista um anúncio para jogar"; anúncios recompensados e intersticiais por mediação AppLovin MAX + AdMob +
  Pangle; compras no app (IAP); consentimento de privacidade (Google UMP).
- Operação: Firebase Analytics, Crashlytics (relatório de travamentos) e Remote Config (muda parâmetros sem
  publicar versão nova).

## Aplicado no Clashcade (01/11)
1. "Surpreenda-me" no menu (sorteia um jogo).
2. "Outro jogo" na tela de resultado dos 6 jogos com Shell (vai direto a outro jogo; placar da sessão continua).
4. (01/11, rodada 4) Modo Torneio melhor de 7, Sumô Neon e Cabo de Guerra rítmico (regras próprias).
3. Modo offline (PWA): manifest + ícones + service worker; depois de aberto uma vez, o site abre e joga sem internet
   e pode ser "instalado" na tela inicial. Só ativa no site em https (Cloudflare), não no link de teste.

## Recomendado, ainda não feito (decisão do Leon)
- Jogo Premium liberado por anúncio recompensado (quando houver anúncios); por ora fichas.
- Novos jogos baratos e rápidos (30–60 s): pênaltis, sumô, reflexo, pedra-papel-tesoura, pontinhos (dots and boxes).
- Configuração remota (tipo Remote Config) só quando houver backend; hoje fora de escopo.
- Sinuca e minigolfe têm telas de resultado próprias: "Outro jogo" ainda não está nelas.
