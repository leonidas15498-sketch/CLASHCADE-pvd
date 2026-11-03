# Lig-4
- Código: src/games/connect4/ (logic.ts, ai.ts, index.ts). Testes: tests/connect4/. Medição: tests/bench/connect4.ts. QA: qa/lig4.cjs.
- Grade 7×6; 4 em linha vence (horizontal, vertical, 2 diagonais); grade cheia = empate. Revanche alterna quem começa;
  placar da sessão nas pílulas. Toque na coluna solta; teclado ← → + espaço, ou 1–7.
- IA: minimax com poda alfa-beta + avaliação por janelas de 4 casas e bônus no centro.
  Fácil: 1 jogada à frente, 35% coluna aleatória, 25% 2ª melhor. Médio: 4 jogadas, 8% 2ª melhor. Difícil: 8 jogadas.
  Nunca deixa de ganhar na hora (Médio/Difícil). Difícil leva até ~0,35 s no começo da partida (computador do QA).
- Música (pedido para o Gemini, 01/11; salvar como public/music/lig-4.mp3; volume alvo -14 LUFS; compasso 2,4 s):
  "Original instrumental light chill-funk track for a colorful turn-based strategy game where players drop glossy pieces into a grid to connect four. 100 BPM, 4/4, E Dorian. Tight dry drums with a relaxed pocket groove, round warm synth bass, muted rhythm guitar chops, Rhodes electric piano chords, short playful clavinet riff as the main motif, occasional soft vibraphone accents. Mood: clever, confident, friendly and focused, with a hint of friendly rivalry; never sleepy and never aggressive. Medium-low density, mid-range kept clean so short "drop" and "click" sound effects and a victory jingle stay clearly audible. Consistent groove throughout; subtle changes every 8 bars (hi-hat pattern, guitar on/off, filter on the keys) to avoid fatigue, without builds, drops or breakdowns. No vocals, no speech, no vinyl crackle. Start directly on the groove with no intro, no fade-out; end on a complete bar that resolves back to the opening chord so it can loop. About 2 to 3 minutes. Do not imitate any existing song."
- Música ligada (01/11): "Calculated Gambit", public/music/calculated-gambit.mp3: 104 BPM; 65 compassos; -14 LUFS.
