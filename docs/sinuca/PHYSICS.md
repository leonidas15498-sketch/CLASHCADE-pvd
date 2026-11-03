# PHYSICS.md — modelo físico

## Escala e geometria
- Unidades: metros e segundos. Origem no canto superior esquerdo do campo interno (linha das borrachas).
- Campo interno: 2,54 m × 1,27 m (mesa de 9 pés, proporção 2:1). Bola: diâmetro 57,15 mm (R = 0,028575 m).
- Tabelas: segmentos de reta interrompidos nas 6 caçapas. As bocas existem fisicamente:
  - canto: quinas a 81,5 mm do vértice em cada tabela (boca ≈ 115 mm), garganta com paredes paralelas à diagonal;
  - laterais: boca de 132 mm, garganta perpendicular à tabela.
- As pontas dos segmentos funcionam como quinas (colisão com o ponto mais próximo do segmento).
- Caçapa: zona de captura circular (raio 45 mm) centrada 35 mm além da linha da boca. A bola só cai quando o
  centro entra nessa zona; uma bola que passa rente à boca em ângulo raso bate na quina e não é absorvida.
- Rede de segurança: se uma bola sair dos limites (não observado nos testes), conta como encaçapada na caçapa mais próxima.

## Integração
- Passo fixo `dt = 1/120 s`, com acumulador no laço de render (máx. 12 passos por quadro).
- Subpassos adaptativos: `n = ceil(vmax·dt / (0,25·R))`, limitado a 24 — nenhuma bola anda mais que ¼ do raio por subpasso
  (evita atravessamento até ~9,5 m/s; a velocidade máxima é 6,5 m/s).
- Em cada subpasso: (1) integra posição e atrito; (2) colisões bola-bola em ordem fixa de pares, 2 passadas
  (contatos simultâneos, ex.: abertura); (3) tabelas/quinas; (4) captura em caçapas.
- Determinismo: sem aleatoriedade e ordem fixa de iteração → mesmo estado + mesma tacada = mesmo resultado
  (no mesmo ambiente de execução; testado).
- O render interpola entre a posição do passo anterior e a atual; não altera o estado físico.

## Modelos
| Parâmetro | Valor | Efeito |
|---|---|---|
| `rollDecel` | 0,12 m/s² | resistência de rolamento (μr ≈ 0,012 — feltro de sinuca medido: 0,005–0,015) |
| `linearDrag` | 0,02 1/s | arrasto mínimo, só para a parada final ser suave |
| `slideFriction` | 0,2 | μ de deslizamento no feltro (bola escorregando antes de rolar) |
| `spinDecel` | 22 rad/s² | perda do giro vertical (efeito lateral) |
| `cushionFriction` | 0,2 | μ bola-tabela: transfere efeito lateral no rebote |
| `cushionRollKeep` | 0,5 | fração do giro de rolamento que sobra após a tabela |
| `maxTipOffset` | 0,5 R | distância máxima do centro em que o taco bate |
| `restSpeed` | 0,006 m/s | abaixo disso a bola para (sem vibração residual) |
| `ballRestitution` | 0,95 | colisão bola-bola (massas iguais, impulso na normal) |
| `cushionRestitution` | 0,82 | componente normal após tabela (medido: ~0,75–0,85) |
| `maxCueSpeed` | 9 m/s | velocidade da branca a 100% (abertura forte real: 9–11 m/s) |
| `powerCurve` | 1,5 | `v = 9 · força^1,5` (precisão em tacadas fracas) |

- Bola-bola: correção de penetração dividida igualmente + impulso `j = −(1+e)·v_rel·n / 2`.
- Tabela: reposiciona a bola a R do segmento, inverte e reduz a componente normal.
- Distância até parar (usada pela IA): `D(v) = v/k − (a/k²)·ln(1 + k·v/a)`.

## Giro (efeito) e rolamento
- Eixos: x direita, y para baixo, z para dentro da mesa. Cada bola tem velocidade (vx, vy) e giro (ωx, ωy, ωz).
- Taco: impulso J na direção da mira aplicado no ponto r = R·(lado·p + alto·cima), |offset| ≤ 0,5 R.
  v = J/m; ω = (r × J)/I, I = 2/5·m·R². Bater 2/5 R acima do centro já sai rolando.
- Ponto de contato com o feltro: u = v + ω × (0,0,R). Se |u| > 0 a bola desliza: atrito μ·g oposto a u,
  que reduz |u| a 7/2·μ·g até zerar (a bola passa a rolar). Depois disso: resistência de rolamento + arrasto.
- Bola-bola: impulso só na normal, giro preservado → efeito baixo faz a branca voltar, alto faz seguir.
- Tabela: restituição na normal; na tangente, atrito limitado (μ·(1+e)·|vn|) entre a bola e a borracha
  usando o efeito lateral (ωz); o giro de rolamento é reduzido (a borracha bate acima do centro).
- Orientação (quatérnio) integrada a partir de ω — usada só para desenhar o número e a faixa girando.
- Calibração de 01/11 (valores de referência: Alciatore, *The Illustrated Principles of Pool and Billiards*; Marlow,
  *The Physics of Pocket Billiards*): μ deslizamento ≈ 0,2; rolamento ≈ 0,1 m/s²; abertura 9–11 m/s.
- Resultado medido nos testes: força 20% ≈ 0,8 m/s e percorre ~1,4 m; abertura para em ~6,5 s e derruba
  em média 0,8 bola (63% das aberturas derrubam alguma) em 30 variações.
- Histórico: 0,35 m/s² + arrasto 0,2/s deixou as bolas "presas"; 0,18 + 0,12 sem deslizamento parecia "escorregar".

## Limitações conhecidas (honestas)
- Sem massé (curva por taco inclinado), sem desvio da branca ao bater fora do centro (squirt), sem salto.
- Bolas não transferem "throw" (atrito de contato) — cortes saem no ângulo geométrico ideal.
- Contatos múltiplos são resolvidos sequencialmente (aproximação comum em jogos), não por solver simultâneo.
- Calibração feita por testes e sensação de jogo, não medida contra uma mesa real.

## Calibração
Ajuste em `src/physics/table.ts` (`DEFAULT_PARAMS`). Os testes verificam: parada total, ausência de
sobreposição na abertura, tempo de abertura entre 3 e 20 s, rebote, captura e não captura em caçapas.
