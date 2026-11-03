# Pong
- Código: src/games/pong/ (physics.ts, ai.ts, index.ts). Testes: tests/pong/. Medição: tests/bench/pong.ts. QA: qa/pong.cjs.
- Reaproveita do Air Hockey: mesa 2,0 × 1,0 m (importa `TABLE`), passo 1/240 s, primeiro a 7, controle por metade da tela
  com multitoque, teclado W/S + setas, modelo de IA (reação, erro de previsão, velocidade, distração).
- Física: raquete 18 cm, até 2,8 m/s; bola sai a 2,2 m/s, +10% por rebatida até 6 m/s; ângulo pela parte da raquete
  (centro reto, ponta até 60°). Ponto: bola sai na direção de quem perdeu o ponto.
  Valores escolhidos pela medição: com raquete maior e bola mais lenta, as trocas passavam de 90 rebatidas por ponto.
- IA: Fácil reação 0,28 s, 66% da velocidade, 12% distraída, não volta ao meio; Médio 0,2 s, 70%; Difícil 0,08 s, 95%,
  bate com a ponta para mandar a bola longe do adversário.
- Música (pedido para o Gemini, 01/11; salvar como public/music/pong.mp3; volume alvo -15 LUFS; compasso ~2,03 s a 118 BPM):
  "Original instrumental upbeat electro-funk track for a fast two-player paddle-and-ball arcade game. 118 BPM, 4/4, A minor. Punchy tight drums with a bouncy syncopated groove, rubbery synth bass, short staccato brass-like synth stabs, crisp clap on beats 2 and 4, and a call-and-response motif that bounces between the left and right speakers like a ball going back and forth. Energetic, sporty, competitive and fun, never aggressive. No square-wave or chiptune lead: keep the 300 Hz to 1 kHz range uncluttered so the game's short beep sound effects stay clearly audible. Steady energy for repeated short matches; subtle changes every 8 or 16 bars (percussion layers, filter sweeps on the stabs) without builds, drops or breakdowns. No vocals, no speech. Start directly on the beat, no intro, no fade-out, end on a complete bar musically compatible with the beginning so it can loop. About 2 to 3 minutes. Do not imitate any existing song."
- Música ligada (01/11): "Center Court Rally", public/music/center-court-rally.mp3: 120 BPM; 80 compassos; -15 LUFS.
- **Tamanho da raquete testado (01/11, `npx vite-node scripts/pong-raquete.ts`):** 18 cm mantidos. Pior caso físico (bola a
  4,4 m/s e 55°) leva 0,73 s de uma ponta à outra; com reação de 0,25 s a raquete percorre 1,25 m (mesa 1,0 m) → toda bola é
  alcançável, nenhum ponto é "impossível". Varredura 12–24 cm (60 partidas por tamanho; robôs): casual×casual 16,6 rebatidas
  por ponto e ~2,3 min por partida a 18 cm (12 cm: 6,4 e 1,3 min; 24 cm: 21 e 2,7 min). IA % dos pontos contra o humano
  médio: 13/35/66 (F/M/D) a 18 cm; 16 cm derruba o Difícil para 56%; 22 cm sobe para 85%. Suposição: robô erra menos que
  gente no celular (dedo cobre a tela), então trocas reais tendem a ser mais curtas. Se defender parecer fácil demais
  jogando, testar 16 cm.
