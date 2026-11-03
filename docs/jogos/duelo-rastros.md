# Duelo de Rastros
- Código: src/games/trails/ (logic.ts, ai.ts, index.ts). Testes: tests/trails/. Medição: tests/bench/trails.ts. QA: qa/rastros.cjs.
- Arena 48×28 células. Motos andam 9 → 15 células/s (acelera em 40 s). Melhor de 5 (3 rodadas vencem); empate não conta.
- Bater em parede/rastro perde; mesma célula ou troca de lugar = empate. Meia-volta ignorada; fila de até 2 curvas.
- Controle: deslizar (cada 0,9 célula de arrasto = uma curva, dá para encadear). 2P: metade esquerda = J1, direita = J2.
  Teclado: WASD (J1) e setas (J2; contra a IA, setas movem o J1).
- IA: Fácil só olha a frente, se distrai (3,5%/passo) e vira à toa; Médio escolhe a direção com mais espaço livre;
  Difícil disputa território (quem chega antes em cada célula) e evita encontro de frente.
- Música: "Apex Cornering" (Leon, Gemini), public/music/apex-cornering.mp3: 86 compassos (166,45 s), -15 LUFS, 128 kbps.
