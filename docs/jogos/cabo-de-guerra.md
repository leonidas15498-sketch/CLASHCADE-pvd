# Cabo de Guerra rítmico (01/11)
- Código: src/games/tug/ (logic.ts = regras puras; ai.ts; index.ts). Testes: tests/tug/. Medição: tests/bench/tug.ts.
  QA: qa/cabo.cjs. Rota `#cabo-de-guerra`.
- Regras (proposta original): batida regular que acelera de 100 para 140 BPM em 64 batidas. Cada jogador toca na sua
  metade da tela no tempo. Perfeito (±55 ms) puxa 3, Bom (±130 ms) puxa 2, ×(1 + 0,1·combo) até ×1,5. Toque fora da
  janela ou 2º toque na mesma batida = escorrega 1 e zera o combo (metralhar perde: QA mostrou 25 toques em 1,2 s
  → corda andou 12 para o lado do rival). Batida sem toque zera o combo. Corda a ±32 vence; aos 60 s vence quem estiver
  com a corda do seu lado; meio exato = empate.
- Tempo: toques usam o carimbo do evento (`timeStamp`, mesma base de performance.now) e não o quadro; o tambor é
  agendado no relógio de áudio com 120 ms de antecedência. Pausa desloca o relógio (nenhuma batida "passa" pausada).
- Fone Bluetooth atrasa o som (100–300 ms, suposição pelo que é comum): a ajuda recomenda o alto-falante. Não há
  calibração de atraso ainda (ideia futura, se o Leon notar).
- IA (mesmas janelas; só conhece os instantes das batidas): Fácil σ 85 ms, atraso 35 ms, esquece 16%; Médio σ 55 ms,
  15 ms, 7%; Difícil σ 30 ms, 5 ms, 2,5%. Suposição: leigo erra 40–80 ms (sem medição própria).
- Medido (IA × IA, 60 partidas): Médio vence Fácil 100% (17 s), Difícil vence Médio 100% (22 s), Médio × Médio 53%
  (44 s). Contra gente: não medido — o Fácil pode estar fácil ou difícil demais; jogar e ajustar σ.
- Celular em pé: J2 em cima com rótulos de cabeça para baixo (para quem está do outro lado).

## Música (pacote para o Gemini; salvar como public/music/cabo-de-guerra.mp3)
**Ponto crítico:** o jogo gera a própria batida e ela ACELERA. Uma música com bateria em BPM fixo brigaria com a batida
do jogo (e o loop não é sincronizado com ela). Por isso a música pedida é sem bateria e sem pulso marcado: só cama
harmônica; quem marca o tempo é o tambor do jogo.
1. **Conceito:** cama de cordas e sintetizador quente, sem percussão, com tensão crescente leve (feira/gincana ao ar
   livre à noite), deixando todo o espaço rítmico para o tambor do jogo.
2. **Prompt (copiar):**
   "Original instrumental background bed for a rhythm-based tug of war game where the game itself provides the drum beat. NO drums, NO percussion, NO claps, NO rhythmic pulse or arpeggios: only sustained and slowly evolving harmony. A major, warm string ensemble pads, soft brass swells, a gentle synth pad, occasional long held bass notes. Mood: friendly competition at an outdoor night festival, light anticipation, never tense or dramatic. Chord changes every 4 to 8 seconds, smooth and unhurried, no tempo feel. Leave the mid and low-mid range sparse so a game drum and tap sounds stay clearly audible. No vocals, no speech. Start immediately at full level with no intro, no fade-out, end on the opening chord so it can loop. About 2 minutes. Do not imitate any existing song."
3. **Justificativa:** jogo de ritmo precisa de uma única fonte de tempo; com batida variável (100→140 BPM), qualquer
   bateria na música atrapalharia o jogador. A cama harmônica dá clima sem competir.
4. **Aprovação:** nenhuma batida/percussão audível; o tambor do jogo continua sendo o que se segue; sem voz;
   sem pico de volume; não cansa em 3 partidas seguidas de 60 s.
5. **Loop e volume:** sem compasso fixo: cortar no fim de um acorde longo; normalizar a -18 LUFS (mais baixa que os
   outros jogos, -13,5 a -15, para o tambor do jogo mandar); fade cruzado de 2,5 s.
