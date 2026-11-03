# Empilha (substitui a Torre Perfeita)
- Código: src/games/stack/ (pieces.ts = formas + arte; logic.ts = física/regras; ai.ts; index.ts). Testes: tests/stack/.
  Medição: tests/bench/stack.ts. QA: qa/empilha.cjs.
- **Física: planck.js 1.4.2 (porta do Box2D, MIT).** Decisão 01/11: empilhar corpos que giram e tombam exige resolvedor de
  contatos estável; física própria custaria dias e ficaria instável. Custo: ~54 KB comprimido, só baixado quando o
  Empilha abre. Passo 1/60 s, gravidade 10, atrito 0,75, quase sem quique.
- Regras: vez alternada; a peça fica pendurada 1,6 u acima do topo da pilha; arrastar move, soltar o dedo larga, ⟳ gira 45°.
  Depois de largar espera a pilha parar (0,45 s quieta, máx. 7 s). Peça abaixo de y = -0,9 = caiu → quem jogou perde.
  Solo: empilhar o máximo (recorde em `jogaco.stack.best`).
- 10 peças com arte própria no canvas: gato, sapo, pinguim, porquinho, presente, melancia, queijo, bolo, patinho,
  bola de praia (rara). Forma física simples (polígonos convexos/círculos); orelhas e olhos são só desenho.
- IA: simula a mesma física numa cópia do mundo para várias posições/giros e escolhe a mais estável; depois erra a
  posição conforme o nível. Fácil: 5 posições, sem giro, erro 0,42 u, 30% "no olho". Médio: passo 0,45 u, 0°/90°,
  erro 0,12 u. Difícil: passo 0,2 u, 4 giros, erro 0,03 u e prefere pontos com vizinhos também seguros.
  O planejamento roda em pedaços de 9 ms por quadro (QA: maior intervalo entre quadros 33 ms; Difícil joga em ~1 s).
- Música (pedido para o Gemini, 01/11; salvar como public/music/empilha.mp3; volume alvo -14 LUFS; compasso 2,5 s):
  "Original instrumental playful chamber-pop track for a cute turn-based stacking game where players balance cartoon animals and objects on a wobbly tower. 96 BPM, 4/4, F major with occasional suspended chords that create a gentle "wobbly" suspense. Lead melody on marimba and pizzicato strings, warm upright bass walking lightly, soft glockenspiel accents, brushed snare and light shaker, a few woodblock and clave hits. Cheerful, curious and slightly mischievous, with moments of light tension, never frantic. Sparse, airy arrangement with plenty of space between notes so short impact and "clack" sound effects stay clearly audible. Consistent groove; small variations in instrumentation every 8 bars to avoid fatigue, without big builds, drops or breakdowns. No vocals, no speech, no whistling. Start directly on the groove, no intro, no fade-out, end on a complete bar resolving back toward the opening chord so it can loop. About 2 to 3 minutes. Do not imitate any existing song."
- Música ligada (01/11): "Sunny Stacks", public/music/sunny-stacks.mp3: o Gemini fez 120 BPM (pedido 96); 4 s de introdução cortados; 83 compassos; -14 LUFS.
- **01/11 noite (pedido do Leon):** a guia agora é curta e some (metade do vão até o topo, 0,4–1,1 u) e a "sombra" de onde a
  peça encosta foi removida: calcular a queda faz parte do desafio (`landingY` continua só para depuração/QA).
  Estética pela referência docs/arte/referencias-gpt/ (empilha-arena-previa.png, bichinhos.png): pedestal com anéis de luz
  no chão e coroa, anel âmbar com feixe no lugar do fio da garra, 6 bichinhos novos (urso, panda, raposa, coruja, coelho,
  tartaruga; peso 2 cada) com luz de cima e rosto/orelhas dentro (ou quase) da forma física. Celular em pé: zoom maior
  (vista 8,6 u) e faixa de 86 px embaixo para os botões não cobrirem o pedestal. A referência mostra a sombra de queda: NÃO
  seguir (decisão do Leon vale mais que a imagem).
- 01/11: toque rápido = gira 45° (substitui ⟳); arrastar move; SOLTAR larga. Arena estática em camada própria (FPS).
- **01/11 noite (game feel, pedido do Leon):**
  - Física: amortecimento de giro 0,15 → 1,5 e linear 0 → 0,1 (logic.ts `DAMPING`); cantos da COLISÃO arredondados
    (`roundCorners`: corta o canto mais pontudo a 0,05 u até 12 vértices, limite do planck; o desenho já era arredondado).
  - Medição (scripts/torre-feel.ts; `ANTES=1` reproduz a física anterior). Cenário controlado (mesmas 192 quedas de uma
    peça sobre outra, deslocada 0 / 0,2 / 0,35 u): caíram 10 → 2; estabilização mediana 0,18 → 0,12 s, p90 2,20 → 2,28 s,
    máximo 5,60 → 3,83 s; giro acumulado mediana 0,04 → 0,03 rad. Partidas IA × IA (mudam de rumo, comparação fraca):
    turno mediano 1,27 → 1,33 s (piso = queda de 1,6 u + 0,45 s parada); peças por partida "humano" (IA Média) × IA:
    Fácil 5,1 → 7,5 · Médio 6,8 → 9,4 · Difícil 10,7 → 10,9. Conclusão: a pilha ficou mais estável e tolerante
    (partidas mais longas); o tempo de espera por turno quase não mudou porque é dominado pela queda e pela regra
    de 0,45 s parada.
  - IA recalibrada para a física nova: Fácil erro 0,42 → 0,7 u e "no olho" 30% → 40%; Médio erro 0,12 → 0,1 u.
    Solo (12 pilhas, limite 25): Fácil 4,3 · Médio 9,3 · Difícil 13,1 peças.
  - Impacto: impulso normal do planck (post-solve). ≥ 0,9 = som seco ("toc" grave de 45–65 ms, sem cauda) + poeirinha
    no ponto de contato; ≥ 2,5 = tremor de 2 px até 4 px em 5,5, por 80 ms (só o mundo treme; HUD não). Medido: peça
    pousando dá 2,3–4,0 (p10–p90). "Reduzir animações" do aparelho desliga o tremor.
  - Faixa "Vez de X" no topo, na cor de quem joga (pulsa quando troca); "Esperando a pilha parar…" durante a espera;
    contra a IA: "Vez da IA · pensando…". Substitui o aviso de troca de vez e o texto "IA pensando" no canvas.
  - Câmera: base fixa embaixo e zoom que diminui aos poucos (até onde precisar) para caber pilha + peça pendurada; o
    topo do pedestal nunca sai da tela (QA qa/torre-feel.cjs confere a cada jogada, em pé e deitado).
