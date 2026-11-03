# Jogaço — plataforma de minijogos locais

Portal web com jogos rápidos para 1 pessoa ou 2 pessoas no mesmo aparelho (celular na horizontal ou computador).
Nome "Jogaço" é provisório.

| Jogo | Modalidades | Estado |
|---|---|---|
| Sinuca 8-Ball | 1P contra IA (3 níveis), 2P local | Disponível |
| Minigolfe | 1P (9 buracos ou treino), 2P local por turnos | Disponível |
| Air Hockey, Duelo de Rastros, Torre Perfeita | — | Em desenvolvimento (só no catálogo) |

## Comandos
```bash
npm install
npm run dev           # http://localhost:5173
npm test              # Vitest (física, regras, fases, IA)
npm run typecheck
npm run lint
npm run build         # dist/ — cada jogo vira um pedaço baixado só quando é aberto
npm run build:single  # dist-single/index.html (+ pasta music/) — tudo num arquivo
```

## Documentos
- `ARCHITECTURE.md` — estrutura, contrato dos jogos, carregamento sob demanda, persistência.
- `GAME_DESIGN.md` — Minigolfe: regras, física, os 9 buracos.
- `TEST_REPORT.md` — o que foi testado de verdade e o que falta.
- `CLAUDE.md` — regras permanentes e decisões.
- `docs/sinuca/` — física, regras e histórico da Sinuca.
- `docs/proximas-etapas/` — especificações recebidas (plataforma, minigolfe).
