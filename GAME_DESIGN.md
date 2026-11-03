# GAME_DESIGN — Minigolfe "Ilha do Pôr do Sol"

## Modalidades
- **1 Jogador:** 9 buracos (menor total) ou treino de um buraco. Guarda no aparelho o recorde em 9 buracos e o
  melhor resultado de cada buraco.
- **2 Jogadores Local:** mesmo aparelho, apelidos opcionais. Cada um tem sua bola (anel laranja = J1, azul = J2).
  As tacadas **alternam**; quem já terminou o buraco é pulado; o próximo buraco só começa quando os dois terminam.
  As bolas não colidem entre si (cada jogador tem sua própria tentativa no mesmo layout).
  **Menor total vence; empate → menor soma dos 3 últimos buracos; persistindo → empate.**

## Regras
- Cada tacada conta 1. Só dá para tacar com a bola parada (botão desabilitado e física recusa).
- **Fora de campo ou água:** volta ao último ponto onde a bola parou + **1 tacada de penalidade**, com aviso.
- **Limite: 10 tacadas por buraco.** Ao chegar no limite (penalidade incluída), o buraco fecha com 10.
- Reiniciar buraco pede confirmação; no 2P reinicia para os dois.

## Física (TS puro, `src/games/minigolf/physics`)
- Unidades de jogo "u" (bola: raio 0,7 u; copo: raio 1,25 u). Passo fixo 1/120 s, subpassos (≤ 0,3 raio por subpasso).
- Rolamento (calibração 01/11): desaceleração quase constante de 6 u/s², como um carpete de minigolfe; areia +30 u/s².
  Força → velocidade v = 27·√força, então a distância é proporcional à força (10% ≈ 6 u, 50% ≈ 30 u, 100% ≈ 61 u).
  Antes: distância ∝ força², tacadas curtas quase impossíveis de dosar.
- Paredes e obstáculos são cápsulas (segmento + raio); quique com restituição 0,72 e leve perda tangencial.
- Obstáculos móveis (moinho, bloco deslizante) usam a velocidade do ponto de contato na resposta.
  Se a bola parar dentro da área varrida, ela é empurrada para fora (documentado; evita pá atravessando bola parada).
- **Rampas:** zona com aceleração constante (simula inclinação). Mais íngreme que o atrito → bola parada desce.
- **Buraco:** cai se o centro estiver no copo e a velocidade for menor que 13·√(1 − (d/r)²) u/s; rápida demais
  passa por cima com pequeno desvio na borda. Sem "sucção" à distância.
- **Linha de mira:** mesma geometria de colisão (cápsulas), pontilhada só até o primeiro contato ou 20 u.

## Controles
- **Padrão da plataforma (igual à Sinuca):** puxe o taco da barra lateral para baixo e solte; ou pegue o taco atrás
  da bola no campo, puxe e solte. Voltar ao topo/à bola cancela. Tocar à frente da bola mira no ponto; arrastar atrás
  gira o taco. Mira fina ↺ ↻. Espaço/Enter também taca. (Substituiu o botão Tacar da especificação original.)
- Animações: bola na cor do jogador com covinhas girando, rastro, descida do taco (0,14 s) e acompanhamento,
  bola escorregando e afundando no copo (0,75 s), confete no buraco em uma.
- Fundo da tela na cor de quem joga (J1 coral, J2 azul).
- **Tacos:** 3 grátis (Clássico, Madeira, Coral) e 2 premium (Ouro, Neon), só visual; premium liberados para teste.
- **Música:** "Sunday on the Velvet Green" (do Leon), com botão próprio de liga/desliga e volume.

## Os 9 buracos
| # | Nome | Par | O que ensina/testa |
|---|---|---|---|
| 1 | Primeira Tacada | 2 | mirar e dosar força |
| 2 | Curva Suave | 3 | usar a parede para virar |
| 3 | Tabela | 3 | contornar bloco / tabela |
| 4 | Subida | 3 | rampa contra (força) e pedras |
| 5 | Ponte da Ilha | 3 | água e penalidade |
| 6 | Moinho | 3 | obstáculo móvel (tempo) |
| 7 | Zigue-Zague | 4 | dois corredores e areia |
| 8 | Portão Deslizante | 3 | portão + bloco que se move |
| 9 | Grande Final | 4 | rampa a favor, moinho e bloco |

## Limitações
- Visão de cima com volume desenhado (2.5D), não 3D. A câmera enquadra o buraco inteiro (todos cabem na tela),
  então não há câmera seguindo a bola nem zoom manual.
- O par foi definido para jogador humano; o robô de testes (busca exaustiva) joga bem abaixo do par.
