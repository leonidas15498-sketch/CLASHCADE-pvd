# Clashcade — referências de arte para implementação no Canvas

## Entrega
Contém 2 pranchas conceituais novas, recortes individuais de 6 elementos de interface/sprites e 8 capas, além das 3 referências anteriores aprovadas. Arquivos em `docs/arte/referencias-gpt/`.

## Linguagem visual (fonte: prompts-gpt.md)
Navy `#0A1433`, grafite `#1B2337`, ciano `#00E0FF`, vermelho `#FF3B4D`, azul `#2F6BFF`, âmbar `#FFC24A` e teal `#28C7B7`. Jogador 1 sempre vermelho/coral, jogador 2 sempre azul. Neon moderado, formas nítidas, bordas limpas, iluminação superior. Sem textos embutidos em sprites.

## Uso pelo Claude
- Use as PNGs **como direção artística**, não copie regras ou formatos errados das imagens geradas.
- Desenhe o jogo principalmente em Canvas/SVG com dimensões reais da lógica, inclusive Connect Four **7x6** e Blocos Cromáticos **8x8**. As imagens geradas podem distorcer a contagem de células.
- `rastros-motos.png` e `bichinhos.png` são RECORTES DE PRANCHA e **não** sprites transparentes com recorte isolado. Redesene os bichinhos com silhueta física geométrica estável, rosto/orelhas caindo dentro da forma; não altere a física por detalhes visuais.
- As capas foram recortadas das pranchas, e algumas têm proporções diferentes: fazer composição 16:9 na interface com `object-fit: cover` ou redesenhar para evitar cortes.
- Implementar i18n via strings separadas; não rasterizar textos ou placares.
- Rastro visual deve seguir lógica real, tempo/distância, nunca depender do FPS; efeitos premium são apenas cosméticos.
- Manter menu visual previamente aprovado. Não alterar a física da sinuca ou Lig-4 por causa das ilustrações.
- Verificar visualmente cada tela em desktop e celular e comparar com a referência.

## Índice
- `air-hockey.png`
- `pong.png`
- `quatro-em-linha.png`
- `blocos-cromaticos.png`
- `rastros-motos.png`
- `bichinhos.png`
- `capas/sinuca.png`
- `capas/minigolfe.png`
- `capas/air-hockey.png`
- `capas/rastros.png`
- `capas/empilha.png`
- `capas/quatro-em-linha.png`
- `capas/pong.png`
- `capas/blocos-cromaticos.png`

## Critérios de aprovação
1. Consistência visual entre jogos e menu. 2. Contraste legível e layout responsivo. 3. Geometria correta de regras e colisões. 4. Sem quadros pixelizados por escalonamento incorreto do Canvas. 5. Desempenho 30/60/120 FPS sem alteração da velocidade lógica. 6. Nenhum texto/ícone gerado nas imagens conceituais deve substituir labels acessíveis/localizáveis.
