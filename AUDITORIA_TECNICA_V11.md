# Auditoria técnica — Clashcade V11

Data: 02/11/2026  
Projeto: `clashcade-fonte-v11/plataforma/`  
Método: inspeção estática do código, configurações, testes e roteiros de QA.

## Escopo e limitações

Foram analisados arquitetura, jogos, interface, pontuação, persistência, qualidade, testes e scripts de build.

Durante a auditoria, nenhum arquivo foi modificado, nenhuma dependência foi instalada e nenhum comando foi executado fora do workspace. Este documento foi criado posteriormente por solicitação do usuário. Nenhum código ou recurso da JindoBlu foi utilizado.

A pasta `node_modules` estava ausente. TypeScript, ESLint, build, Vitest e testes de navegador não foram executados. Não há confirmação atual de aprovação dessas verificações, de FPS ou de funcionamento em aparelhos físicos.

Os achados abaixo distinguem constatações estáticas, riscos condicionados a entradas ou ambiente e pontos que exigem medição. As referências de linha correspondem ao código inspecionado. Os links relativos abrem os arquivos; a linha relevante é indicada no texto.

## Organização e inventário

| Diretório | Responsabilidade |
|---|---|
| `src/app` | Aplicação React e navegação por hash |
| `src/pages` | Catálogo, loja, configurações e montagem dos jogos |
| `src/components` | Componentes visuais reutilizados |
| `src/games` | Dez jogos e registro central |
| `src/games/shared` | Menus, HUD, áudio, efeitos, jogadores e contrato de montagem |
| `src/services` | Persistência, economia, resultados e torneios |
| `src/i18n` | Traduções |
| `src/styles` | Estilos do portal |
| `tests` | Testes de regras, física, IA e serviços |
| `qa` | Roteiros de navegador |
| `public` | Ícones, músicas, manifesto e service worker |

Os componentes principais são `App`, `Home`, `GamePage`, `Shell` e os módulos individuais. O catálogo usa carregamento sob demanda, e cada jogo expõe o contrato `mount()` / `destroy()`.

As dependências de produção React, React DOM e Planck têm uso identificado. Não foi encontrada dependência de produção claramente desnecessária. Planck é usado na física da Torre de Bichinhos.

### Jogos implementados

O [registro central](src/games/registry.ts) disponibiliza os dez jogos abaixo. A presença no código não comprova funcionamento integral em execução.

| Jogo | Modos identificados | Mecânica e controles |
|---|---|---|
| Sinuca 8-Ball | Contra IA; 2P local | Mira, força, efeito, posicionamento da branca e caçapa cantada para a 8 |
| Minigolfe | Solo; treino; 2P por turnos | Mira e força; nove buracos, obstáculos, água e penalidades |
| Air Hockey | Contra IA; 2P simultâneo | Arraste ou WASD/setas; primeiro a sete gols |
| Duelo de Rastros | Contra IA; 2P simultâneo | Deslizes ou teclado; colisões com paredes e rastros; três vitórias |
| Torre de Bichinhos | Solo; contra IA; 2P por turnos | Posicionamento, rotação e soltura; perde quem provocar queda |
| Quatro em Linha | Contra IA; 2P por turnos | Seleção de coluna; quatro peças alinhadas |
| Pong | Contra IA; 2P simultâneo | Arraste ou W/S e setas; primeiro a sete pontos |
| Blocos Cromáticos | Solo; 2P sequencial | Encaixe em grade 8×8, limpeza de linhas e combos |
| Sumô Neon | Contra IA; 2P simultâneo | Joystick por toque ou teclado; avanço; duas vitórias |
| Cabo de Guerra | Contra IA; 2P simultâneo | Toques rítmicos ou teclado; penalidade por erro e repetição |

Os oito jogos com IA oferecem Fácil, Médio e Difícil. Minigolfe e Blocos não possuem adversário controlado por IA.

## A. Problemas críticos

Não foi identificada evidência suficiente para classificar um problema como crítico de segurança. Os seguintes achados têm criticidade alta para disponibilidade ou integridade funcional.

### A1 — Hash malformado pode interromper o portal

- **Evidência:** [src/app/App.tsx](src/app/App.tsx), linha 8.
- **Constatação:** `decodeURIComponent()` é chamado sem tratamento de erro.
- **Cenário:** uma URL terminada em `#%` provoca erro de decodificação. A barreira de erros de `GamePage` fica abaixo desse ponto.
- **Impacto:** interrupção da renderização inicial ou erro durante a navegação.
- **Correção proposta:** tratar a decodificação e retornar ao catálogo em caso de entrada inválida.

### A2 — Validação incompleta dos dados persistidos

- **Evidências:** [storage da Sinuca](src/games/pool/storage/storage.ts), linha 36; [economia](src/services/economy.ts), linha 41; [torneio](src/services/tournament.ts), linha 36; [preferências compartilhadas](src/games/shared/shell.ts), linha 499.
- **Constatação:** a Sinuca combina JSON com valores padrão sem validação estrutural; outros validadores verificam apenas parte dos campos.
- **Risco condicionado:** dados como nomes nulos, estatísticas incompletas ou contadores com tipos incorretos podem chegar à interface e às regras.
- **Impacto:** exceções, dados inconsistentes e perda de acesso a telas.
- **Correção proposta:** validar tipos, elementos de arrays, limites e invariantes; recuperar valores padrão por campo e prever migrações.

### A3 — Exclusão de caches sem isolamento por aplicação

- **Evidência:** [public/sw.js](public/sw.js), linha 9.
- **Constatação:** a ativação remove todos os caches da origem cujo nome seja diferente de `clashcade-v1`.
- **Risco condicionado:** outras aplicações na mesma origem podem perder seus caches.
- **Correção proposta:** excluir somente versões antigas com prefixo exclusivo do Clashcade.

## B. Bugs funcionais

| ID | Achado | Evidência | Consequência |
|---|---|---|---|
| B1 | Confirmação de saída não pausa automaticamente | [shell.ts](src/games/shared/shell.ts), linha 463 | A janela abre sem alterar `paused`; a simulação pode continuar durante a decisão. |
| B2 | Teclas não são limpas ao perder foco | [Pong](src/games/pong/index.ts), linha 154; [Hockey](src/games/airhockey/index.ts), linha 140; [Sumô](src/games/sumo/index.ts), linha 206 | Um `keyup` perdido pode deixar movimento acionado ao retornar. |
| B3 | Limpeza não garantida após montagem parcial | [GamePage.tsx](src/pages/GamePage/GamePage.tsx), linha 40 | Se `mount()` lançar antes de retornar, não há instância para chamar `destroy()`. |
| B4 | Carteira sem transação entre abas | [economy.ts](src/services/economy.ts), linha 68 | Duas abas podem sobrescrever alterações baseadas no mesmo saldo. |
| B5 | Sorteio vazio não termina | [tournament.ts](src/services/tournament.ts), linha 65 | `drawOrder([])` permanece no laço; o fluxo atual normalmente fornece jogos. |
| B6 | Interpolação da Sinuca pode extrapolar | [app.ts](src/games/pool/ui/app.ts), linha 1081 | Sob acúmulo de tempo, `alpha` pode exceder um; o efeito visual exige reprodução. |
| B7 | Efeitos do Cabo dependem da frequência da tela | [index.ts](src/games/tug/index.ts), linha 198 | Uso de `1/60` por quadro altera a duração visual em outras frequências. |

### Mecânicas e física a revisar

- **Torre:** a estabilização termina após sete segundos mesmo com movimento residual; na mira a física não avança. Isso pode transferir consequências de instabilidade para a próxima jogada. Evidência: [logic.ts](src/games/stack/logic.ts), linhas 283 e 295.
- **Blocos 2P:** cada jogador recebe um sorteio independente. Uma semente compartilhada reduziria a variação entre oportunidades, embora o preenchimento adaptativo ainda possa divergir conforme as jogadas. Evidência: [index.ts](src/games/blocks/index.ts), linha 192.
- **Minigolfe:** a correção que afasta a bola de obstáculos móveis desloca sua posição sem revalidar imediatamente paredes, água e limites. É um risco geométrico a testar. Evidência: [sim.ts](src/games/minigolf/physics/sim.ts), linha 252.

A base usa passos fixos, subpassos adaptativos em Sinuca e Minigolfe e limites de velocidade no Hockey. Essas escolhas reduzem riscos numéricos, mas não comprovam ausência de atravessamentos ou estabilidade em todos os cenários.

### Pontuação e persistência

O código contém integração dos resultados dos dez jogos com os serviços de partida, distinção entre solo/IA/local, placar de sessão, torneio, fichas, desafios e estatísticas específicas.

- Não há ranking online ou sincronização remota implementada identificada. Histórico local e recordes individuais não equivalem a ranking global.
- Não foi identificada retomada persistida de partidas em andamento.
- Falhas de gravação são ignoradas; a interface pode indicar sucesso sem garantir persistência.
- A deduplicação conserva uma quantidade limitada de identificadores.
- O funcionamento offline é progressivo: jogos ainda não carregados podem não estar disponíveis sem rede.
- A atualização do cache em segundo plano não usa `event.waitUntil()` para assegurar sua duração. Evidência: [sw.js](public/sw.js), linhas 16 e 22.

## C. Melhorias de interface

| Melhoria | Fundamentação |
|---|---|
| Preservar instruções no mobile | Até 560 px, título/subtítulo e nomes do HUD são ocultados. Informações dinâmicas precisam de alternativa. [shell.ts](src/games/shared/shell.ts), linha 104. |
| Completar acessibilidade das janelas | Implementar semântica de diálogo, foco inicial, contenção e restauração de foco. [shell.ts](src/games/shared/shell.ts), linha 463. |
| Uniformizar abandono | A navegação por hash troca a tela sem confirmação da partida. [App.tsx](src/app/App.tsx), linha 14. |
| Completar teclado da dificuldade | Os controles usam papéis de rádio, mas não implementam navegação específica por setas. [shell.ts](src/games/shared/shell.ts), método `bind()`. |
| Tornar Premium inequívoco | A liberação para testes está ativa, sem integração de compra identificada. [flags.ts](src/games/shared/flags.ts), linha 6. |
| Reduzir fragilidade da tradução | Sinuca e Minigolfe traduzem textos por observação do DOM; frases sem correspondência permanecem em português. [domTranslate.ts](src/i18n/domTranslate.ts). |

O menu contém catálogo, loja, configurações, placar local, desafios, sorteio e torneio. O CSS prevê grades adaptativas, áreas seguras e tratamento parcial de movimento reduzido.

Há suporte explícito a multitoque e divisão por regiões. Sumô e Cabo adaptam a divisão entre jogadores em retrato; Pong e Hockey preservam a mesa horizontal. A adequação visual precisa ser confirmada em navegador e celular físico, incluindo telas pequenas, teclado virtual, orientação e Safari.

## D. Melhorias de arquitetura, cobertura e build

### Arquitetura

A separação de regras e física do DOM é um ponto positivo. Entretanto, os controladores visuais acumulam entrada, desenho, áudio, menus, resultados e animações. Sinuca e Minigolfe têm controladores com mais de mil linhas e interfaces próprias, paralelas ao `Shell`.

Recomenda-se compartilhar primeiro serviços pequenos de pausa, entrada, persistência e encerramento, preservando as regras testáveis de cada jogo.

A IA do Quatro em Linha é síncrona dentro de um temporizador. O temporizador adia a busca, mas não retira seu custo da thread da interface. Medir bloqueio antes de decidir por Worker ou busca incremental. Evidência: [index.ts](src/games/connect4/index.ts), linha 159. A IA da Sinuca também exige medição em aparelhos modestos.

### Cobertura dos testes

Foram encontrados **21 arquivos `*.test.ts`**. Não há configuração de instrumentação, relatório percentual ou limites mínimos em [package.json](package.json) e [vite.config.ts](vite.config.ts). Não é possível atribuir percentual de linhas, funções ou ramificações cobertas.

| Área | Evidência existente | Avaliação estática |
|---|---|---|
| Sinuca | Colisões, efeito, caçapas, regras, controlador e IA. [physics.test.ts](tests/pool/physics.test.ts), linha 22. | Maior profundidade de cenários identificada. |
| Minigolfe | Física, penalidades, turnos, desempate e solução das fases. [rules.test.ts](tests/minigolf/rules.test.ts), linha 7. | Diversidade de testes de domínio; não comprova interface. |
| Demais jogos | Regras fundamentais e IA; Blocos inclui determinismo. [blocks.test.ts](tests/blocks/blocks.test.ts), linha 129. | Cobertura funcional presente, sem medição quantitativa. |
| Economia e sessão | Bônus, teto diário, compras e deduplicação. [economy.test.ts](tests/economy/economy.test.ts), linha 63. | Storage simulado em memória; não verifica concorrência real entre abas. |
| Torneio | Sorteio, empate, resultado repetido e campeão. [tournament.test.ts](tests/tournament/tournament.test.ts), linha 20. | Faltam cenários de lista vazia e estado corrompido. |
| Navegador | Roteiros de menu, partidas e inspeção visual. [menu.cjs](qa/menu.cjs), linha 15. | Diversas verificações imprimem resultados sem falhar automaticamente diante de divergências. |

Lacunas prioritárias:

1. Hash inválido e recuperação de montagem parcial.
2. Pausa, confirmação, perda de foco e entradas presas.
3. Dados salvos corrompidos, incompletos e falhas de gravação.
4. Concorrência entre abas.
5. Instalação, atualização e isolamento do service worker.
6. Acessibilidade e teclado.
7. Estabilidade visual em frequências e orientações diferentes.

O teste de desempenho da IA da Sinuca permite até 1.500 ms em um cenário. Esse limite não demonstra fluidez de interface. Evidência: [ai.test.ts](tests/pool/ai.test.ts), linha 91.

O [TEST_REPORT.md](TEST_REPORT.md), linha 3, informa 97 testes em sete arquivos. É um registro histórico que não representa o inventário atual inteiro; os resultados não foram reproduzidos nesta auditoria.

### Scripts de build e qualidade

| Script | Comando | Análise |
|---|---|---|
| `build` | `tsc --noEmit && vite build` | Inclui TypeScript; não inclui lint ou testes. |
| `build:single` | `vite build --mode single` | Não inclui a verificação TypeScript do build normal. |
| `typecheck` | `tsc --noEmit` | Abrange `src` e `tests`; scripts e configurações ficam fora. |
| `lint` | `eslint src tests` | QA e service worker ficam fora. |
| `test` | `vitest run` | Não inclui os roteiros `qa/*.cjs`. |

Referências: [package.json](package.json), linha 6; [tsconfig.json](tsconfig.json), linha 20; [vite.config.ts](vite.config.ts), linha 7; [eslint.config.js](eslint.config.js), linha 5.

- TypeScript habilita `strict`, verificações de itens não utilizados e de queda entre casos de `switch`.
- `noUncheckedIndexedAccess` não está habilitado, apesar do uso frequente de índices.
- Há afirmações de não nulidade em acessos ao DOM que não substituem validação em execução.
- QA importa `playwright`, ausente das dependências declaradas. Evidência: [menu.cjs](qa/menu.cjs), linha 3.
- O modo `single` não demonstra distribuição totalmente autocontida: músicas continuam referenciadas como arquivos externos.
- Ambos os builds produzem arquivos em `dist` ou `dist-single`. Sua execução não é uma verificação sem escrita.

## E. Plano de implementação priorizado

Estimativas em dias úteis de uma pessoa familiarizada com o projeto, incluindo testes direcionados. São preliminares, não compromissos de prazo. Risco de regressão refere-se à implementação da correção.

| Ordem | Trabalho | Criticidade | Impacto no usuário | Esforço | Risco de regressão |
|---|---|---|---|---|---|
| P0 | Tratar hash inválido — A1 | Alta | Portal indisponível com determinada URL | Até 0,5 dia | Baixo |
| P0 | Validar e recuperar persistência — A2 | Alta | Falhas de telas, partidas e dados | 2–4 dias | Médio |
| P0 | Restringir exclusão de caches — A3 | Alta | Perda de cache na mesma origem | 0,5–1 dia | Médio |
| P1 | Corrigir pausa nas confirmações — B1 | Alta | Perda de pontos durante decisão | 1–2 dias | Alto |
| P1 | Limpar entradas ao perder foco — B2 | Média | Movimento involuntário | 0,5–1 dia | Médio |
| P1 | Limpar montagem parcial — B3 | Média | Recursos residuais após falha | 1–2 dias | Médio |
| P1 | Serializar operações da carteira — B4 | Média | Saldo ou compras inconsistentes | 2–3 dias | Alto |
| P1 | Proteger sorteio vazio e interpolação — B5/B6 | Média | Travamento condicionado e saltos visuais | 0,5–1 dia | Baixo/médio |
| P1 | Tornar QA verificável e alinhar validações de build | Média | Regressões passam despercebidas | 1–3 dias | Baixo |
| P2 | Rever Torre e competição de Blocos | Média | Justiça e previsibilidade | 2–4 dias | Alto |
| P2 | Corrigir HUD mobile e acessibilidade | Média | Compreensão e operação da interface | 2–4 dias | Médio |
| P2 | Medir IAs e corrigir animações por tempo | Média | Fluidez e consistência | 1–4 dias | Médio/alto |
| P3 | Reduzir duplicação dos controladores | Baixa no curto prazo | Manutenção e consistência futura | 4–8 dias | Alto |

### Critérios de validação após implementação

1. Reproduzir cada cenário corrigido e adicionar regressão direcionada.
2. Executar TypeScript, ESLint e Vitest com dependências previamente disponíveis.
3. Validar os dois builds em ambiente que permita gerar seus artefatos.
4. Executar QA com asserções e erro de processo em caso de divergência.
5. Validar desktop, celular em retrato e paisagem, multitoque, troca de foco e navegação de retorno.
6. Testar duas abas, armazenamento indisponível e saves inválidos.
7. Testar instalação e atualização offline sem afetar caches de outras aplicações.

## Parecer

O projeto apresenta dez jogos registrados, carregamento sob demanda e separação útil entre regras, física e interface. A aprovação técnica permanece pendente de execução das verificações, reprodução dos cenários apontados e validação mobile. A existência do código e dos testes não comprova, por si só, funcionamento integral.
