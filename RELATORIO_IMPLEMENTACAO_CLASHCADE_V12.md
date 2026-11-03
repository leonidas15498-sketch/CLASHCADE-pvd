# Implementação Clashcade V12 — estabilidade, etapa 1

Data: 02/11/2026. Diretório: C:\Users\Admin\OneDrive\Documents\clashcade\clashcade-fonte-v12\plataforma.

## 1. Resumo

A V12 é uma cópia independente da V11, sem alteração dos originais. Foram corrigidos os seis grupos P0 solicitados, com alterações limitadas aos pontos de controle e recuperação. Não houve redesenho, novos jogos, monetização ou mudança de parâmetros de equilíbrio. Nenhum código, imagem, música ou recurso da JindoBlu foi usado.

As auditorias técnica e comparativa foram lidas; os problemas foram conferidos nos arquivos correspondentes antes das alterações. Cópia inicial excluiu node_modules, dist, dist-single, .git, .vite, coverage e logs.

## 2. Arquivos modificados

- public/sw.js
- src/app/App.tsx
- src/games/airhockey/index.ts
- src/games/blocks/index.ts
- src/games/connect4/index.ts
- src/games/minigolf/index.ts
- src/games/minigolf/ui/app.ts
- src/games/minigolf/ui/sfx.ts
- src/games/pong/index.ts
- src/games/pool/index.ts
- src/games/pool/game/sound.ts
- src/games/pool/storage/storage.ts
- src/games/pool/ui/app.ts
- src/games/shared/music.ts
- src/games/shared/powerGauge.ts
- src/games/shared/sfx.ts
- src/games/shared/shell.ts
- src/games/stack/index.ts
- src/games/sumo/index.ts
- src/games/trails/index.ts
- src/games/tug/index.ts
- src/pages/GamePage/GamePage.tsx
- src/services/economy.ts
- src/services/storage.ts
- src/services/tournament.ts

Novos arquivos de implementação/teste: src/app/route.ts; src/services/validation.ts; src/games/shared/lifecycle.ts; tests/stability/stability.test.ts. Também foram adicionados este relatório, provas de hashes, qa/v12-browser.cjs e resultados JSON de navegador.

package.json e package-lock.json permanecem iguais à V11. Apenas dependências locais declaradas foram instaladas via npm ci; nenhum pacote global ou dependência nova foi adicionado.

## 3. Problemas confirmados e soluções

| Grupo | V11 | V12 |
|---|---|---|
| Navegação | decodeURIComponent sem proteção | decodeRoute captura escapes inválidos; rotas desconhecidas continuam indo ao catálogo |
| Economia/persistência | Validação parcial e descarte integral de dados malformados | Recuperação por campo, números seguros não negativos, datas verificadas, preservação de saldo, inventário e ledger válidos |
| Torneio | Arrays e conteúdo parcialmente validados | Sanitização de nomes/rotas/resultados/IDs, placar reconstruído dos resultados; sorteio vazio rejeitado em vez de laço infinito |
| Sinuca | Merge superficial do JSON | Preferências e estatísticas internas recuperadas por campo; dificuldades, temas, tacos, histórico e valores válidos preservados |
| Falhas de armazenamento | Exceções absorvidas | Continuidade sem exceção; store compartilhado mantém último estado em memória após falha de leitura/gravação; carregamento não regrava dados corrompidos automaticamente |
| Confirmação | Simulação continuava | Pausa lógica e callback onPause; cancelamento restaura estado anterior, inclusive relógio do Cabo; confirmação a partir de pausa mantém a pausa |
| Sinuca/Minigolfe | Interfaces próprias sem a mesma proteção | Confirmações pausam física/relógios; blur/ocultação pausam; gestos e repetição de mira são cancelados |
| Entradas | Teclas e gestos podiam ficar presos | Limpeza de teclas/ponteiros/joysticks/arrastes em pausa e perda de foco; entradas pausadas são ignoradas; pointercancel por ponteiro preservado |
| Montagem parcial | Instância indisponível quando construtor falhava | mountSafely executa rollback em ordem reversa; construtores registram donos antes da alocação; estilos/tradução/áudio/medidor têm limpeza própria |
| Quatro em Linha | Timer da IA podia vencer durante pausa | Timer é cancelado ao pausar e reprogramado ao retomar quando cabível |
| Service worker | Excluía todos os outros caches da origem | Remove somente caches com prefixo clashcade- que não sejam clashcade-v12 |
| Áudio — encontrado em navegador | resume pendente rejeitava ao fechar contexto | Rejeições de resume/suspend/close são tratadas; Music impede reinício após dispose; medidor tem dispose idempotente |

O rollback é compatível com mount/destroy existentes e não altera APIs globais. Cada recurso deve continuar registrando seu dono se novas alocações forem adicionadas. Falha em uma limpeza não impede as demais. O medidor e Music também registram rollback porque podem ser criados em inicializadores, antes do corpo do construtor do jogo.

## 4. Testes executados e resultados

| Verificação | Resultado observado |
|---|---|
| npm.cmd ci --cache .npm-cache --no-audit --no-fund | 199 pacotes instalados, sem alteração deliberada do lockfile |
| npm.cmd run typecheck | Aprovado nas execuções realizadas, sem erros |
| npm.cmd run lint | Aprovado, sem erros |
| npm.cmd test — suíte completa | 216 testes aprovados / 22 arquivos, 190,66 s; rodada antes dos dois últimos testes adicionais |
| Regressões após persistência | 28 testes / 3 arquivos aprovados, 7,65 s |
| Regressões finais após correção de áudio | 29 testes / 3 arquivos aprovados, 5,96 s; 13 casos de estabilidade + 12 economia + 4 torneio |
| npm.cmd run build | Build aprovado; última compilação observada: 117 módulos, 11,86 s |
| Edge headless por CDP, viewport 390×844 | 39 cenários aprovados, zero exceções de página na rodada final |
| SHA-256 da V11 | 208 arquivos conferidos contra o inventário anterior; zero alterações |

Não somar as contagens como testes distintos: as rodadas direcionadas repetem casos da suíte. Não foi executada uma nova suíte completa com os dois casos adicionais; as regressões afetadas foram reexecutadas.

### Falhas encontradas e repetição

1. python.exe estava inacessível. A execução foi interrompida e o usuário autorizou continuar por PowerShell. Nenhum arquivo da V11 foi alterado.
2. npm.ps1 foi bloqueado pela política de scripts. O usuário autorizou npm.cmd, sem mudar a política do sistema.
3. npm ci no sandbox falhou por EACCES de rede e avisos de limpeza EPERM. A repetição autorizada fora do sandbox terminou com sucesso. Houve aviso sobre allowScripts do esbuild; o executável instalado foi efetivamente usado pelos testes/build aprovados.
4. Vitest/build no sandbox falharam ao resolver configuração com Access is denied. Repetidos com autorização fora do sandbox, passaram. Essas falhas não foram consideradas aprovação.
5. Primeira rodada de navegador percorreu 36 cenários, mas falhou com 23 rejeições de áudio. Resultado preservado em qa/v12-browser-results-inicial.json. A causa foi corrigida e a rodada ampliada passou sem exceções, conforme qa/v12-browser-results.json.

### Conteúdo das regressões automatizadas

- Hash válido, codificado, desconhecido e malformado; dez entradas no catálogo.
- JSON inválido, campos ausentes/tipos incorretos, limites e datas impossíveis; preservação independente de progresso válido.
- Falhas de leitura/gravação/reset e preservação temporária em memória sem compartilhar snapshots mutáveis.
- Preferências e estatísticas aninhadas da Sinuca; torneio e lista de sorteio vazia.
- Rollback reverso, limpeza que lança e isolamento entre montagens.
- Restauração da pausa anterior e notificação do callback de simulação.
- Ativação real da função de service worker em ambiente simulado, preservando cache externo.
- Rejeição de resume de áudio durante fechamento.

### Testes reais de navegador automatizados

Foi usado o Edge instalado, headless, com perfil temporário isolado, servidor local e CDP nativo do Node. Não foram instalados Playwright/Puppeteer. O harness persistido está em qa/v12-browser.cjs; usa Edge no caminho padrão do Windows e exige build prévio. Execute a partir do projeto: node qa/v12-browser.cjs. Usa portas 4182 e 9225, que precisam estar livres.

- Catálogo após hash inválido, desconhecido e vazio, com dez cartões.
- Oito jogos com Shell: todos os modos existentes; três dificuldades nos sete desses jogos que têm IA; confirmação/cancelamento, pausa/retomada e retorno ao menu.
- Estado de simulação comparado durante 250 ms de confirmação em cada combinação do Shell.
- Tecla pressionada seguida de blur: mapas de teclas zerados em Pong, Hockey e Sumô.
- Sinuca local/IA e Minigolfe solo/duo: início, tacada, confirmação e física/relógios comparados durante 300 ms; cancelamento retoma.
- Falha injetada no contexto Canvas ao montar Sinuca: erro tratado, estilos específicos e medidor removidos, retorno ao catálogo.

Esses testes são automatizados em navegador desktop com viewport mobile, não testes em celular físico. Cliques são acionados pelo DOM; não equivalem a toque humano, escuta ou avaliação visual.

## 5. Verificação de regressão dos dez jogos

| Jogo | Código/regras | Navegador executado |
|---|---|---|
| Sinuca | Testes de física, regras, IA, efeitos e novas regressões de save | Local e IA; pausa com tacada |
| Minigolfe | Física, regras, nove fases, personalização e hole-in-one | Solo e duo; pausa com tacada |
| Air Hockey | Física e IA | Local e IA fácil/média/difícil; foco e pausa |
| Duelo de Rastros | Regras, trajeto e IA | Local e três níveis; pausa |
| Torre de Bichinhos | Física e IA | Solo, local e três níveis; pausa |
| Quatro em Linha | Regras e IA | Local e três níveis; pausa |
| Pong | Física e IA | Local e três níveis; foco e pausa |
| Blocos Cromáticos | Regras, pontuação e determinismo | Solo/local; pausa |
| Sumô Neon | Física, regras e IA | Local e três níveis; foco e pausa |
| Cabo de Guerra | Ritmo, regras e IA | Local e três níveis; pausa |

Comparação estática: registro, lógicas/físicas/níveis dos jogos, catálogo de cosméticos, temas, tacos, traduções e regras de pontuação/recompensas permanecem sem alteração de parâmetros. Integração de resultados/revanche continua no código; economia e torneio passaram em testes automatizados. Isso não representa validação end-to-end de todas as telas de resultado ou de cada cosmético.

## 6. Falhas e limitações restantes

- Nenhum teste manual foi executado. Celular físico, Safari/iOS, áudio percebido, Bluetooth e bateria permanecem pendentes.
- Multitoque físico, pointercancel real do sistema, troca real de app e orientações diversas não foram validados nesta rodada. O tratamento foi inspecionado e a perda de foco automatizada foi testada.
- Não foram concluídas partidas humanas de todos os jogos, nem testados todos os caminhos de revanche, resultados, equipagem e compra pela interface. Regras têm testes existentes; fluxos completos restantes estão pendentes.
- Sinuca teve IA iniciada no navegador com a preferência padrão; suas três dificuldades foram preservadas estaticamente e testadas na suíte de IA, não todas pela interface nesta rodada.
- Service worker foi testado em ambiente simulado, não em instalação/atualização real HTTPS/PWA.
- O cache em memória não substitui persistência durável: dados não gravados se perdem ao fechar a página. Não foi adicionada notificação visual de falha de armazenamento, para evitar redesenho nesta etapa.
- A persistência continua local e sem proteção transacional entre abas. Sinuca mantém suas rotinas próprias de gravação, com fallback seguro de leitura e tratamento de exceções, sem sincronização remota.
- A recuperação de um torneio malformado usa os resultados válidos como fonte do placar; dados sem histórico suficiente podem ser reparados para um estado reduzido. Não regrava automaticamente o original ao apenas carregar.
- Novos recursos futuros precisam seguir o contrato de rollback; não há promessa de capturar alocações arbitrárias ou listeners de terceiros sem dono registrado.
- Regras de estabilização da Torre, sorteios competitivos dos Blocos e calibração de dificuldade não foram alterados, conforme escopo de estabilidade.

## 7. Riscos de regressão

Pausa/cancelamento e encerramento têm risco médio/alto por compartilharem o ciclo de vida. O comportamento do Quatro em Linha ao reagendar IA e o relógio do Cabo merecem testes físicos prolongados. Recuperação de dados tem risco médio por lidar com versões antigas; preserva as chaves e os campos válidos. Cache mudou para clashcade-v12 e precisa de validação de atualização em produção. Layout e equilíbrio permanecem intactos.

## 8. V11 versus V12 e entrega

V11 original preservada; prova em V11_HASHES_ANTES.json e V11_VERIFICACAO_FINAL.json. V12 contém a mesma base de dez jogos, seus modos, três dificuldades onde existentes, temas, tacos, cosméticos, moedas, desafios e torneio. Apenas controle de navegação/persistência/pausa/entradas/recursos/cache e testes foram ajustados.

O ZIP de entrega é CLASHCADE_V12.zip na raiz do workspace, com a pasta clashcade-fonte-v12/plataforma. Exclui node_modules, dist, dist-single, caches, perfis de navegador, temporários e logs. Não inclui APK, bundle REA ou recursos da JindoBlu. Os arquivos locais de dependências/build podem permanecer na cópia de trabalho para revalidação, sem entrar no ZIP.

## 9. Próximas melhorias recomendadas

1. Rodada manual em Android e iOS: multitouch, cancelamento do sistema, foco, áudio e retomada.
2. Testar resultados/revanche e compra/equipagem de cada jogo em navegador, com saves antigos reais anonimizados.
3. Validar atualização offline em HTTPS e concorrência entre abas, sem misturar isso a monetização.
4. Somente depois considerar melhorias de HUD/acessibilidade das auditorias; manter mudanças de mecânica em etapa própria.
