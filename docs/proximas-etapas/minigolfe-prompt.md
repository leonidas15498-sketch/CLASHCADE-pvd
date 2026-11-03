# PROMPT MESTRE — MINIGOLFE WEB (1P E 2P LOCAL)

## Missão
Você é uma equipe sênior de game design, engenharia de física, desenvolvimento web, UX mobile e QA. Desenvolva um minigolfe autoral, completo, jogável e testável no navegador. Use a imagem anexada como **referência de direção artística**, não como interface pronta ou geometria física. Não entregue apenas mockup, protótipo visual ou plano.

## Escopo obrigatório
- **1P Solo:** completar 9 buracos com o menor total de tacadas; registrar melhor resultado local, progresso e resultado por buraco.
- **2P Local:** duas pessoas no mesmo aparelho, em turnos, com bolas identificadas, cada uma jogando sua própria tentativa no mesmo buraco; após ambas terminarem, avançar para o próximo. Comparar total de tacadas em 9 buracos; menor total vence. Desempate por menor total nos últimos 3 buracos, e, persistindo, declarar empate. Não exigir cadastro nem internet após os assets estarem carregados.
- Tela inicial com botões explícitos **1 Jogador** e **2 Jogadores Local**. Permitir inserir apelidos locais. O modo 2P não é um recurso futuro.
- Nove fases **realmente diferentes**, projetadas e jogáveis, com par por buraco e progressão gradual. As primeiras três devem ensinar a mecânica sem tutoriais longos. Distribuir curvas, paredes, rampas simples, obstáculos estáticos e pelo menos um obstáculo móvel nas fases posteriores.
- Tela de seleção de fase para solo, placar por buraco, resultado final e revanche. Não declarar funções inacabadas como prontas.

## Direção visual
Basear-se na imagem de referência: minigolfe estilizado, colorido, com gramado verde, bordas de madeira, cenário tropical ao pôr do sol, iluminação agradável, UI legível com painel de fase, par, tacadas, força, pausa, mira fina e câmera. A imagem é conceitual: **não copiar literalmente perspectivas impossíveis, trajetórias inconsistentes ou controles que não funcionem**. Criar assets originais, preferencialmente procedurais e leves. A câmera deve permitir ver claramente a bola, obstáculos e buraco; considerar visão 2.5D/top-down com leve perspectiva em vez de 3D completo caso isso melhore física, desempenho e custo.

## Física — prioridade máxima
Implementar motor de simulação consistente com timestep fixo e coordenadas de mundo independentes de resolução. A bola tem raio, massa, velocidade, desaceleração por rolamento, atrito, colisão com bordas, resposta a obstáculos, repouso com limiar de velocidade, e captura no buraco apenas em condições físicas plausíveis (distância e velocidade compatíveis). Não atravessar paredes, não tremer indefinidamente, não acelerar espontaneamente. Rampas só devem ser incluídas se houver simulação coerente de inclinação/gravidade; caso contrário substituí-las por obstáculos planos e documentar a decisão.

Separar **lógica de física e regras em TypeScript puro**, sem dependência de Phaser, canvas ou DOM. A renderização pode usar Phaser ou Canvas 2D; preferir a opção mais simples que alcance qualidade e performance. Usar o mesmo simulador para movimento real e previsão de mira. Testar colisões, conservação aproximada do momento nas colisões quando aplicável, dissipação, repouso, paredes, captura no buraco e limites da força.

## Controles e linha de mira
- Antes da tacada, exibir uma **linha pontilhada de mira** saindo da bola até a primeira colisão com borda/obstáculo ou até um comprimento máximo. Não desenhar trajetória após ricochete nem caminho futuro completo; a linha deve respeitar o mesmo modelo geométrico usado na colisão.
- **Barra de força visual de 0 a 100%**, com valor numérico e controle por arraste; potência determina impulso de forma consistente. Permitir mirar independentemente de ajustar a força.
- Mira fina por controle sensível e acessível, com pequenos incrementos; rotação de câmera apenas se realmente implementada e útil. No celular, evitar que o dedo esconda a bola e impedir scroll acidental durante a interação.
- Botão **Tacar** claramente visível; não tacar ao simplesmente arrastar a mira. Bloquear novos disparos enquanto a bola se move.
- Feedback de tacada, impacto, queda no buraco e resultado; sons opcionais, sem autoplay inesperado.

## Regras e UX
- Cada tacada válida conta uma vez. A bola só pode ser tacada após parar.
- Fora de campo: recolocar no último ponto seguro e aplicar **uma tacada de penalidade adicional**, informando a regra ao jogador.
- Limite por buraco: 10 tacadas; ao atingir o limite, encerrar a tentativa com pontuação 10 e registrar o resultado. Se a penalidade exceder o limite, aplicar o teto e encerrar.
- Pausa, reinício de buraco com confirmação, voltar ao menu com confirmação, configurações de som, estado persistido localmente. Em 2P, reinício exige confirmação e afeta ambos os jogadores.
- No 2P, deixar muito claro **de quem é a vez**, mostrar a bola ativa e impedir interação indevida com a bola do outro. Cada jogador tem seu estado próprio de posição e tacadas; o layout do buraco é idêntico.
- Em telas pequenas, permitir ajustar zoom/enquadramento automaticamente para visualizar o percurso inteiro quando possível, e câmera acompanhando a bola durante o movimento.

## Tecnologia
React + TypeScript + Vite. Phaser apenas se oferecer vantagem clara; caso contrário Canvas 2D. Sem backend, login ou anúncios nesta versão. Estrutura modular para integrar futuramente ao portal de minijogos. Sem serviços pagos, sem credenciais e sem dependência de assets externos em runtime. Salvar progresso e recordes em localStorage com versionamento de esquema e tratamento de dados inválidos.

## Arquitetura mínima
- src/game/physics: simulação pura e colisões
- src/game/rules: pontuação, turnos, conclusão e penalidades
- src/game/levels: dados de nove fases e validação
- src/game/render: renderização e câmera
- src/components: UI, menus e HUD
- src/storage: persistência local
- tests: testes unitários de física e regras

## Testes obrigatórios
1. Build de produção e checagem TypeScript sem erros.
2. Testes Vitest das regras e da física, sem canvas.
3. Testes de colisão em ângulos diferentes, velocidades altas e cantos.
4. Testes de bola parada, buraco, fora de campo, limite de tacadas e troca de turno.
5. Testar os nove buracos, garantindo que cada um é solucionável e não possui spawn bloqueado.
6. Testar modo 1P e partida completa de 2P, incluindo empate, vitória e revanche.
7. Se navegador automatizado estiver disponível, verificar mobile e desktop, botões e interação por toque. Não alegar testes que não foram executados.
8. Documentar limitações reais, especialmente simplificações de física e desempenho.

## Critérios de aceite
Consigo abrir a página, selecionar 1P, jogar nove buracos e ver meu total; ou selecionar 2P local, inserir nomes, alternar turnos no mesmo dispositivo, completar os nove buracos e ver o vencedor. A mira mostra somente a linha até a primeira colisão, a barra de força altera de fato a tacada e a física se comporta de maneira estável. Tudo precisa funcionar em celular e desktop.

## Entrega e execução
Crie README.md, GAME_DESIGN.md, ARCHITECTURE.md, TEST_REPORT.md e CLAUDE.md com regras permanentes **derivadas desta especificação**. Entregue código-fonte completo e ZIP se possível. Trabalhe em etapas: (1) projeto e física pura; (2) renderização e controles; (3) nove fases; (4) modos 1P/2P; (5) UX e testes. Faça checkpoints verificáveis. Não publique nem faça gastos sem autorização. Comece inspecionando o ambiente, proponha brevemente a arquitetura e **implemente de verdade**.
