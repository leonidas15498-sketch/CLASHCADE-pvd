# Cobrinha / Snake (src/games/snake) — 04/11/2026
- Regras em logic.ts: grade 24×16; fruta = +1; parede/corpo = fim; o rabo que sai no passo não bloqueia.
  Solo: recorde de frutas (acelera 7 → 14 passos/s). Duelo (IA ou 2P simultâneo): vence a rodada quem sobreviver ou chegar a
  16 pedaços; batida de frente = empate; melhor de 5 (3 rodadas). Está no Torneio.
- Controle: deslizar (na tela toda; no 2P cada um na sua metade) e teclado (WASD / setas).
- IA (ai.ts): Fácil vai guloso na fruta (erra 8% dos passos); Médio = caminho mais curto (BFS) + checagem de espaço, reage
  devagar (35% dos passos segue reto); Difícil = BFS + espaço + disputa a fruta em que chega antes + evita a cabeça do rival.
  Bench (tests/bench/snake.ts): sozinha Fácil 17 · Médio 78 · Difícil 96 frutas; Médio vence Fácil 68%, Difícil vence Médio 68%,
  Difícil vence Fácil 72% das rodadas (corrida até 16 tem muita sorte de onde nasce a fruta).
- Música: falta (musicUrl null). Loja: nenhuma ainda.
