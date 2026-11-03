# Direção musical do Jogaço (pedido do Leon, 01/11)
Para cada jogo novo, Claude cria um prompt original em inglês para o Gemini (Lyria).

Antes do prompt, analisar: gênero e mecânica do jogo, intensidade da partida, duração média, estética visual,
ritmo das ações, necessidade de concentração e frequência de repetição da música.
Definir de propósito: gênero, BPM, tonalidade/modo, instrumentação, groove, atmosfera, densidade, dinâmica, estrutura.
Não usar synthwave por padrão: cada jogo tem identidade sonora própria.

Regras: instrumental, sem voz/fala; mixagem que não mascare os efeitos; começo direto no ritmo; variações sutis para
evitar cansaço; sem introdução longa, breakdown desnecessário nem fade-out; pedir início e fim compatíveis (harmonia e
ritmo). Não prometer loop perfeito só pelo prompt (o corte no compasso e o fade cruzado são feitos aqui). Nada de imitar
músicas existentes.

Entregar sempre: (1) conceito musical em português, (2) prompt final em inglês pronto para copiar, (3) justificativa,
(4) critérios objetivos de aprovação depois de ouvir, (5) orientação de loop e volume no jogo.

Pós-processamento (Claude, quando o Leon manda o mp3): medir silêncio e cauda; cortar num número inteiro de compassos;
normalizar (sinuca/golfe ≈ -13,5 LUFS; jogos de ação com muitos efeitos -15 LUFS); 128 kbps em public/music/;
loop com fade cruzado de 2,5 s (shared/music.ts).
