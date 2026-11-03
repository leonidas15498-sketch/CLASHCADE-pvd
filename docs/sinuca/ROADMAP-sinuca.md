# ROADMAP

## Concluído (etapas 0–7 do MVP)
- [x] Projeto Vite + TS, docs (`CLAUDE.md`, `PHYSICS.md`, `RULES.md`, `README.md`).
- [x] Mesa 2:1 (9 pés), 6 caçapas com bocas físicas, triângulo WPA com 8 no centro, branca na cozinha.
- [x] Motor físico puro e determinístico (passo fixo 1/120 s, subpassos anti-atravessamento).
- [x] Guia de mira por raycast com a mesma geometria do motor, só até o primeiro contato; linha vermelha se a 1ª bola seria falta.
- [x] Taco lateral de puxar e soltar (também roda do mouse e ↑/↓ + Espaço), recuo do taco de ~110 ms.
- [x] Regras 8-ball (variante WPA simplificada), cantar caçapa da 8, bola na mão com validação.
- [x] Modo 2P Local com nomes, alternância, HUD de grupo/bolas restantes, revanche (alterna quem abre).
- [x] Modo 1P vs IA (Fácil/Médio/Difícil), IA com tacadas diretas, verificação por simulação, segurança e bola na mão.
- [x] Pausa, reinício e volta ao menu com confirmação; som sintetizado persistente; estatísticas locais.
- [x] Aviso de orientação em retrato (pode ser dispensado).

## Ajustes de 01/11 (pedidos do Leon)
- [x] Textos do HUD com cor explícita e contraste alto; `color-scheme: dark` declarado.
- [x] Bola errada na mira: linha vermelha + X sobre a bola.
- [x] Bolas de cada jogador no placar (apagadas = já caíram) e faixa "Encaçapadas" com todas, em ordem.
- [x] Relógio da partida e tempo por tacada no anel da foto de quem joga; tempo esgotado = falta (testado).
- [x] Barra de força virou um taco: puxar e soltar taca; voltar ao topo cancela (testado no navegador).

## Música (01/11)
- [x] Trilha "Midnight Felt" em loop sem emenda audível (fade cruzado), com liga/desliga e volume.
- Testado no navegador: só começa após o primeiro toque, desligar/religar, volume salvo, emenda (arquivo de teste
  de 6 s reiniciou 3 vezes em 9 s, como esperado). Não ouvido por um humano.
- [ ] Confirmar termos de uso comercial da música gerada no Gemini antes dos anúncios/app.

## Ajustes de 01/11 (mira pelo taco, tacos, física recalibrada)
- [x] Física recalibrada com valores medidos de sinuca real (bolas não ficam mais "presas").
- [x] Mira pelo taco na mesa: girar atrás da branca; pegar no taco, puxar e soltar para tacar.
- [x] Barra de força: marcas de 10%, cor de "tensão", brilho pulsante acima de 85%, clarão e vibração ao tacar.
- [x] Escolha de tacos: 3 grátis e 3 premium (bloqueados até haver loja). Escolha salva no aparelho.
- Testado: 57 testes; no navegador: girar pelo taco (+0,300 rad exato), tocar à frente, puxar e voltar (cancela),
  puxar 48% e soltar (taca sem desviar a mira), seletor de tacos, queda/canaleta, efeito baixo e tempo/pausa.

## Ajustes de 01/11 (animação das encaçapadas)
- [x] Bola caindo na caçapa: escorrega para a boca, encolhe, escurece e gira.
- [x] Canaleta à direita da mesa: cada bola encaçapada aparece no alto e desce rolando até empilhar, na ordem.
- [x] Placar com as bolas desenhadas em 3D (as que já caíram ficam apagadas).
- [x] Faixa de mensagens fixa embaixo da mesa (não cobre mais bolas).
- Testado: 57 testes (4 novos da animação); no navegador: queda, descida na canaleta, ordem igual à oficial,
  reinício limpa a canaleta, tempo/pausa e taco de puxar continuam funcionando.

## Próximo grande passo
Plataforma multijogos + Minigolfe (`docs/proximas-etapas/`). Depois: anúncios e app.

## Ajustes de 01/11 madrugada (giro, efeito, atrito)
- [x] Bolas giram de verdade ao rolar (número e faixa acompanham o movimento).
- [x] Efeito: botão da bola branca → escolher ponto de batida (alto, baixo, lados). Volta ao centro após cada tacada.
- [x] Física de deslizamento → rolamento; puxar/seguir após colisão; efeito lateral muda saída da tabela.
- [x] Mais atrito: bolas param antes (abertura ~4 s).
- Testado: 53 testes (inclui puxar/seguir, efeito lateral na tabela, guia exata com efeito, rotação = distância/raio,
  determinismo); no navegador: seletor de efeito, tacada com efeito baixo voltando a branca, bolas girando, tempo/pausa.
- Não testado nesta rodada: partida completa pela interface no navegador (as partidas IA×IA completas rodam nos testes).

## O que foi testado de verdade (01/11/2026)
- `npm run typecheck`, `npm run lint`, `npm test` (45 testes passando), `npm run build` e `npm run build:single`.
- Testes automatizados: colisões frontal/oblíqua, momento, parada total, abertura sem sobreposição, rebote,
  captura e não captura em caçapas, raycast (1ª bola, bloqueio, tabela, caçapa, coincidência com o motor < 4 mm),
  determinismo, bloqueio de tacada com bolas em movimento, todas as faltas/vitória/derrota da variante,
  bola na mão, reinício, IA (alvos legais, posicionamento, Difícil > Fácil, partidas completas IA×IA nos 3 níveis).
- Navegador real (Chrome headless, viewport 844×390 com toque e 1440×860):
  - partida completa 2P Local pela interface (21 tacadas, cantar a 8 por toque, vitória, revanche, pausa → menu com confirmação);
  - partida completa 1P vs IA Difícil (faltas, bola na mão arrastando a branca, derrota registrada nas estatísticas, revanche com IA abrindo);
  - build de arquivo único aberto via `file://`, mira por toque, barra de força, TACAR, aviso de retrato; 0 erros de JavaScript.
  - Observação: nesses testes as jogadas "humanas" foram calculadas pelo script e aplicadas pelos mesmos controles da UI.

## Pendente / não validado
- [ ] Teste manual em celular físico (iOS Safari e Android Chrome): sensação do toque, desempenho da IA (Difícil ≈ 0,2 s no PC; em celular fraco pode chegar a ~1 s).
- [ ] Sons só verificados quanto a ausência de erros, não ouvidos.
- [ ] Calibração "sentida" da física por jogadores reais (atrito, força máxima).

## Próximos passos sugeridos
1. Testar no celular e ajustar `rollDecel`/`maxCueSpeed` se o jogo parecer lento ou rápido.
2. Massé e desvio da branca (squirt), se fizer falta.
3. Rodar a IA em Web Worker se o Difícil travar em aparelhos fracos.
4. PWA (instalar na tela inicial, offline).

## Bugs conhecidos
- Nenhum reproduzido nos testes acima.
