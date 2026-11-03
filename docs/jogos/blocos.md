# Blocos Cromáticos (id `blocks`, rota `#blocos`)
Puzzle de blocos original (nome, arte e UI próprios; "Block Blast" é marca de outra empresa — não usar).

## Regras (src/games/blocks/logic.ts)
- Grade 8×8; bandeja com 3 peças que não giram; usadas as 3, vêm outras 3. Fim = nenhuma peça da bandeja cabe.
- Peças: 15 famílias (1 a 9 quadradinhos) com rotações como peças separadas; pesos de sorteio em `SHAPES` (hipótese).
- Justiça: a bandeja nova sempre traz ao menos 1 peça que cabe (até 30 sorteios; senão troca uma pela maior que cabe).
- Semente fixa reproduz a partida (`createBlocks(seed)`).

## Pontuação
- +1 por quadradinho colocado.
- Limpar L linhas/colunas de uma vez: 10·L·(L+1)/2 → 10, 30, 60, 100.
- Combo: cada jogada que limpa soma 1 à sequência; multiplicador 1 + 0,5·(seq − 1), máx. ×5, só sobre os pontos de limpeza.
  Zera depois de 3 jogadas seguidas sem limpar.
- Grade vazia após limpar: +300 (sem multiplicador).

## Faixas (calibradas por robôs, NÃO por pessoas — tests/bench/blocks.ts)
| Robô | mediana | p90 | jogadas |
|---|---|---|---|
| aleatório | 50 | 103 | 12 |
| atento (1 jogada) | 480 | 1.432 | 55 |
| planejador (2 jogadas) | 2.574 | 5.212 | 120 |
Faixas: Bronze 300 · Prata 1.000 · Ouro 2.500 · Diamante 6.000. Revisar com partidas reais do Leon e de outras pessoas.

## Modos
- 1P: recorde local (`jogaco.blocks.v1`: best, games, bestLines). 2P: cada um joga uma partida inteira, maior pontuação vence;
  2P não altera o recorde.
- Teclado: 1–3 escolhem a peça, setas movem, Enter/espaço encaixam.

## Música
"Seven Blue Tiles" (Leon, Gemini). Medido: 110 BPM exatos; corte em 72 compassos (157,1 s) a partir de 0,12 s,
antes do fade final (~164 s); -14,4 LUFS, pico -0,9 dB, 128 kbps. Falta ouvir a emenda do loop no aparelho.

## QA
`node qa/blocos.cjs <saida>`: catálogo, arrastar com mouse, limpar linha (313 = 3 + 10 + 300), jogada inválida, fim, recorde,
2P, painel de música, retrato e paisagem, erros.
