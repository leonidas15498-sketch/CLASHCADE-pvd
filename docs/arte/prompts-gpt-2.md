# Prompts de imagem para o GPT — rodada 2: menus, lojas e personagens (03/11/2026)

Continuação de `prompts-gpt.md` (mesma paleta e mesmo "Bloco fixo"). Base aprovada: `referencias-gpt/universo-visual-aprovado.png`.
As imagens são REFERÊNCIA de direção visual: o jogo redesenha tudo em código (canvas/HTML). Por isso:
- sem texto nas imagens (o jogo tem português e inglês); nos menus, pedir rótulos em branco ou ícones;
- uma imagem por vez, em paisagem 16:9 (celular deitado), salvar como PNG em `docs/arte/referencias-gpt/<nome>.png`;
- se vier com texto, letras borradas ou logotipo, pedir de novo: "same image, remove all text and letters".

## Como usar
1. Abrir um chat novo no GPT e enviar a imagem `universo-visual-aprovado.png` junto com o primeiro prompt
   ("use this as the style reference").
2. Colar o **Bloco fixo** + o prompt do item. Gerar 2 variações, escolher 1.
3. Mandar as escolhidas aqui no chat (ou salvar na pasta acima e dar commit).

## Bloco fixo (colar no início de cada prompt)
Original game art for "Clashcade", an arcade minigame collection played on a phone held sideways. Style: polished stylized
3D-ish illustration, dark navy arena (#0A1433) with charcoal surfaces (#1B2337), cyan UI accents (#00E0FF), red side (#FF3B4D)
vs blue side (#2F6BFF), warm amber highlights (#FFC24A), teal (#28C7B7) for success states. Moderate glow, crisp readable
shapes, soft spotlights from above, rounded friendly UI. No text, no letters, no numbers, no logos, no watermark, no real
brands, no existing game characters. Where a label would go, use a blank rounded pill or a simple icon. Landscape 16:9.

## 1. Portal — tela inicial (catálogo de jogos)
Mobile landscape UI mockup of the main game catalog screen. Top bar: small home-style brand emblem on the left (abstract
shape, no letters), a coin counter pill with an amber token icon, a settings gear and a profile circle on the right. Below,
a horizontal row of category filter pills (one highlighted in cyan). Main area: a grid of 10 large rounded game cards
(2 rows visible, horizontal scroll hint), each card with a cover illustration area and a blank title pill underneath; one
card is focused with a cyan glow and slight lift. A wide "tournament" banner card with a trophy icon at the end of the row.
Big touch targets, clear hierarchy, nothing smaller than a thumb.

## 2. Menu de um jogo (escolha do modo) — mesmo molde para todos os jogos
Mobile landscape UI mockup of a single game's start menu, shown over a blurred version of the game's table in the background.
Left side: large game cover thumbnail and a blank title pill. Right side: three big stacked mode buttons, each with an icon:
a robot head (play vs computer, with a 3-step difficulty selector of small pills below it), two silhouettes side by side
(two players on the same phone), and a globe/link icon (online private room). Bottom row of round icon buttons: shop bag,
how-to-play question mark, music note, back arrow. The shop bag button has a small amber badge. Clean, calm, very
readable, generous spacing.

## 3. Loja dentro do jogo — exemplo Sinuca
Mobile landscape UI mockup of an in-game shop for a pool game, opened as a full panel on top of the game's menu.
Left column: vertical tabs with icons only (cue stick, table, light trail). Center: a 3x2 grid of item cards showing cue
sticks drawn horizontally with different wood, carbon, neon and gold designs; each card has a price pill with an amber
token icon, one card marked "owned" with a teal check, one "equipped" with a cyan outline, two locked premium items with a
small crown and a soft violet tint. Right column: a large live preview of the selected cue over a green felt corner with a
white ball. Coin balance pill at the top right. No text.

## 4. Loja dentro do jogo — exemplo Air Hockey
Same layout as the pool shop mockup (left icon tabs, center item grid, right live preview), but for air hockey: tabs for
table theme, puck, mallet. Item grid shows mallets in different finishes (glossy red, carbon, ice crystal, lava, chrome,
neon ring) — designs only change the look, all the same size. Preview shows the chosen mallet hitting a puck on a dark
graphite table with neon rim. No text.

## 5. Sumô Neon — lutadores (vista de cima)
Sprite sheet, top-down view, two original chubby round sumo-style fighters designed as SIMPLE circles (the body is a perfect
circle; arms, belt knot and topknot are small decorations that stay inside or right at the circle edge): one red
(#FF3B4D) with an amber belt, one blue (#2F6BFF) with a cyan belt. Three poses each: idle, pushing (arms forward), dashing
(speed lines behind). Cute, friendly, not realistic, no faces of real people. Transparent background, each sprite centered
in its own square, 1:1.

## 6. Sumô Neon — ringue
Top-down circular sumo ring floating in the dark arena: glowing cyan circular boundary, slightly worn charcoal clay surface
with subtle concentric pattern, red start mark on the left and blue on the right, an amber inner circle that suggests the
ring will shrink. Spotlights from above, soft crowd silhouettes far in the dark edges. Landscape 16:9.

## 7. Cabo de Guerra rítmico — personagens e corda
Side view illustration: two original cute chunky characters pulling a thick glowing rope, red team character on the left
(#FF3B4D outfit), blue team character on the right (#2F6BFF outfit), feet braced, a center flag knot on the rope with an
amber light, a rhythmic drum with cyan rings in the background center. Characters built from simple rounded shapes so they
can be redrawn in code. Also a separate small sprite strip of each character in 3 states: pulling, slipping, celebrating.
Transparent background for the strip.

## 8. Capas que faltam (mesmo estilo das 8 capas anteriores)
Card cover illustration 16:9 for a game called [JOGO], showing [CENA] inside the dark Clashcade arena with red and blue
banners and soft spotlights. Same camera height and lighting as the existing covers. No text.
- Sumô Neon: two round sumo fighters (red and blue) colliding in the center of a glowing circular ring.
- Cabo de Guerra rítmico: red and blue characters pulling a glowing rope over a center line, drum rings pulsing behind.

## 9. Personalização — Air Hockey e Pong (temas para a loja)
Grid of 6 small top-down theme swatches for an air hockey table and 6 for a pong court, each swatch showing only the play
surface and rim: classic graphite, ice rink, lava stone, neon synthwave, wooden arcade, galaxy. Same camera and same scale
in every swatch so they can be compared. No text.

## Depois (segundo momento, não fazer agora)
- Minigolfe: novos cenários de buraco (deserto, neve, cidade à noite, castelo) — quando formos criar mais fases.
