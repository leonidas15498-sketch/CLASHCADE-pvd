# Sumô Neon (01/11)
- Código: src/games/sumo/ (logic.ts = física/regras puras; ai.ts; index.ts = Shell + canvas). Testes: tests/sumo/.
  Medição: tests/bench/sumo.ts. QA: qa/sumo.cjs. Rota `#sumo-neon`.
- Regras (proposta original, não copiada): ringue circular de raio 1 u, lutadores de raio 0,16 u, massas iguais.
  Quem tiver o centro fora do ringue perde o round; os dois juntos = round anulado (repete). Depois de 10 s o ringue
  encolhe até 60% em 20 s; aos 20 s vence quem estiver mais perto do centro. Melhor de 3 (2 rounds).
- Controle: joystick que nasce onde o dedo toca (46 px = força máxima), na metade da tela de cada jogador
  (em pé: J1 embaixo, J2 em cima, o mundo gira 90°; deitado: J1 à esquerda). Toque rápido (< 260 ms, < 10 px) = avanço
  (+2,3 u/s, recarga 1,15 s, anel âmbar quando pronto). Segundo dedo do mesmo jogador só dá avanço.
  Teclado: J1 WASD + espaço; J2 setas + Enter.
- Física: passo fixo 1/120 s; aceleração 4,4 u/s², arrasto 2,75/s (cruzeiro ≈ 1,6 u/s); choque com restituição 0,85.
- IA (mesmos controles; reação e erro de mira por nível): Fácil 0,38 s, mira ±0,5 rad, sem cuidado com a borda;
  Médio 0,22 s, fica entre o rival e o centro, foge da borda; Difícil 0,12 s, prevê o rival, desvia de avanço perto da borda.
- Medido (IA × IA, 40 partidas, lados alternados): Médio vence Fácil 88%; Difícil vence Médio 68%; Difícil vence Fácil 100%.
  Duração média: 12 s (Difícil × Fácil) a 46 s (Difícil × Médio); round 5–16 s. Contra gente: não medido.
- Efeitos: choque = som grave curto + poeira + tremor 2–4 px (só choque forte); saída = confete; rastro no avanço.

## Música — LIGADA (02/11): "The Final Bout" (Leon, Gemini) em public/music/the-final-bout.mp3
- Medido: ~135 BPM (não 132; compasso 1,778 s). Original 123,8 s, -13 LUFS. Cortado de 1,881 s (primeiro tempo do
  groove; antes havia ~1,2 s de entrada) por 64 compassos (113,8 s, frase de 8 compassos fecha no início); -2 dB →
  -15,3 LUFS, pico -1,4 dBFS, MP3 128 kb/s. Falta ouvir a emenda do loop e o choque por cima no celular.

### Pacote original enviado ao Gemini
1. **Conceito:** percussão de conjunto grande e seca (tambores graves de madeira, palmas, baquetas) com baixo
   sintetizado curto e metais curtos nos acentos: energia de "entrada na arena", rounds de segundos. Médios fortes e
   pouco subgrave para não esconder o "tum" do choque (120–170 Hz) e o avanço (380 Hz).
2. **Prompt (copiar):**
   "Original instrumental hybrid percussion track for a fast neon sumo arena game where two players push each other out of a glowing ring in rounds of a few seconds. 132 BPM, 4/4, D minor. Driving ensemble of large dry wooden drums, tight claps and stick clicks, a staccato synth bass on off-beats, short bright brass stabs every 4 bars, a simple two-note synth motif. Bold, competitive and playful, like a sports arena warm-up, not aggressive or dark. Keep the low end light and controlled (no heavy sub bass, no long booming kicks) and leave space in the mix so short impact sound effects stay clearly audible. Consistent groove; subtle variations every 8 bars without builds, drops or breakdowns. No vocals, no chants, no speech. Start directly on the groove with no intro, no fade-out, end on a complete bar that resolves back to the opening so it can loop. About 2 minutes. Do not imitate any existing song."
3. **Justificativa:** partidas de 12–46 s pedem pulso alto e constante (132 BPM ≈ 2,2 batidas/s, rápido sem cansar);
   percussão seca combina com choques físicos; sem synthwave (Pong/Rastros já têm sintetizador).
4. **Aprovação (ouvir no celular, efeitos ligados):** choque e avanço audíveis por cima da música; nenhuma voz/coro;
   começa no ritmo em < 1 s; sem trecho "vazio" > 4 s; sem ficar irritante em 3 partidas seguidas.
5. **Loop e volume:** cortar em número inteiro de compassos (1 compasso = 1,818 s a 132 BPM); normalizar a -15 LUFS
   (jogo de ação com efeitos); fade cruzado de 2,5 s (shared/music.ts).
