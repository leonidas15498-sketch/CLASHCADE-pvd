# Arquitetura Clashcade — referência V12 e evolução V13

## Inspeção e proteção

V12: `clashcade-fonte-v12/plataforma`. V13: cópia independente em `clashcade-fonte-v13/plataforma`, excluindo dependências, builds, caches e perfis temporários. Não foi encontrado Git na raiz do workspace, na versão ou em plataforma. Nenhuma branch ou push foi criado. Hashes de 218 arquivos de referência estão em `V12_REFERENCE_HASHES.json` na raiz do workspace.

Antes das alterações: `npm.cmd test` na V12 aprovou 218 testes em 22 arquivos, duração de 225,40 s. TypeScript e ESLint também foram executados com saída zero. Nenhum resultado de teste da V13 é presumido a partir dessa linha de base.

Foram consultados AUDITORIA_TECNICA_V11.md, RELATORIO_IMPLEMENTACAO_CLASHCADE_V12.md, o comparativo disponível na raiz e documentação do projeto. As auditorias são hipóteses históricas; problemas devem ser reconferidos no código atual. O comparativo JindoBlu não comprova sua experiência em execução.

## Dependências e scripts

React/React DOM 18: portal; Planck 1.4: corpos rígidos da Torre. TypeScript 6 strict, Vite 5, plugin React, Vitest 2 e ESLint/typescript-eslint são ferramentas locais declaradas. O lockfile é a referência de instalação. Não há Supabase no package.json da V12.

- `dev`: Vite.
- `build`: `tsc --noEmit && vite build` → dist.
- `build:single`: Vite no modo single → dist-single; não inclui typecheck.
- `typecheck`: TypeScript sobre src e tests.
- `lint`: ESLint sobre src e tests.
- `test`: Vitest, `tests/**/*.test.ts`; QA de navegador é separado.

## Fluxo do portal

`main.tsx` → `App.tsx`/`route.ts` → `Home.tsx` ou `GamePage.tsx` → `registry.ts` → import dinâmico do jogo → `mount(container, options)` → `destroy()` ao sair.

GamePage fornece loading, erro e rollback síncrono por mountSafely. Construtores registram recursos em onMountRollback. Hooks de áudio/medidor também registram donos, inclusive quando criados antes do corpo do construtor. O encerramento normal continua responsabilidade de cada destroy/dispose.

Home contém catálogo, loja, configurações de idioma, desafios diários, sessão Vermelho × Azul, sorteio e torneio. Cover desenha capas em SVG. `portal.css` contém identidade navy/ciano/coral/azul/âmbar e adaptações de tela.

## Dez jogos e interfaces

| Registro | Diretório | Modos V12 | Interface/regras |
|---|---|---|---|
| sinuca | games/pool | IA (3 níveis), 2P local | Template/CSS/controlador próprios; física, regras, IA e render separados |
| minigolfe | games/minigolf | Solo/treino, 2P por turnos | Template/CSS próprios; fases, física, regras, render e storage separados |
| air-hockey | games/airhockey | IA (3), 2P simultâneo | Shell; física/IA separadas |
| duelo-rastros | games/trails | IA (3), 2P simultâneo | Shell; grade de colisão e trilhas vetoriais já existentes |
| empilha | games/stack | Solo, IA (3), 2P por turnos | Shell; Planck, peças e planejador de IA |
| lig-4 | games/connect4 | IA (3), 2P por turnos | Shell; regras puras 7×6 e minimax |
| pong | games/pong | IA (3), 2P simultâneo | Shell; passo físico 1/240 s |
| blocos | games/blocks | Solo, 2P sequencial | Shell; regras puras, bandejas, combos, recordes |
| sumo-neon | games/sumo | IA (3), 2P simultâneo | Shell; joystick/dash e física/regras separadas |
| cabo-de-guerra | games/tug | IA (3), 2P simultâneo | Shell; relógio rítmico, julgamento e IA |

Shell compartilha menu, dificuldades, nomes, HUD, pausa/confirmação, ajuda, resultado, revanche, áudio, cor da vez e relatório de partidas. Sinuca/Minigolfe têm variantes próprias que devem receber correções equivalentes quando cabíveis. Não substituir esses motores para uniformizar aparência.

## Economia, progressão e dados

`catalog.ts` é a fonte de itens, preços, categorias e níveis default/coins/premium. `economy.ts` controla carteira, inventário, bônus diário, teto de recompensa e desafios. `match.ts` integra recompensa e `session.ts`. `tournament.ts` mantém sorteio, partidas, quatro vitórias e deduplicação. Mudanças devem preservar chaves e envelopes existentes.

`storage.ts` oferece persistência versionada e fallback em memória para falhas; `validation.ts` recupera campos. Sinuca possui storage próprio; Minigolfe, Blocos e Torre mantêm recordes/preferências específicos. Tudo é local; a interface RemoteSync não é implementação remota. Não há ranking online. Ledger e IDs têm retenção limitada, e localStorage não fornece transação entre abas.

Tacos, mesas, campos, rastros e explosões são visuais. Seus seletores dependem dos catálogos específicos e da autorização do catálogo comum. A flag Premium de testes existe na V12; não confundir com pagamento implementado nem alterar suas regras sem decisão explícita.

`i18n` usa dicionários no portal/Shell e tradutor de DOM na Sinuca/Minigolfe. `shared/music`, `sfx`, `musicControl`, `fx`, `powerGauge`, `players` são compartilhados. Manter preferências e recursos válidos. Não foi identificado seletor global de FPS na inspeção inicial; confirmar antes de adicionar ou declarar ausência definitiva. Rastros já usam tempo/distância em vários jogos.

## Cloudflare e offline

Vite usa `base: './'`. Cloudflare Pages recebe conteúdo compilado de dist na raiz do ZIP; não há configuração Wrangler/backend encontrada. Assets e oito músicas vêm de public/ e do bundle. main registra sw.js em produção HTTPS fora de iframe. SW isola caches clashcade e permite offline progressivo do que foi aberto. Não colocar autenticação, RPCs ou eventos de rede sob cache de recursos estáticos.

## Online — implementação V13 e limites

V12 tinha apenas referências textuais à integração Supabase. V13 adiciona `@supabase/supabase-js` como dependência de runtime (carregamento dinâmico) e implementa cliente modular para Quatro em Linha. A conexão Supabase desta sessão retornou `projects: []`; nenhuma credencial ou projeto foi criada e a migração não foi aplicada remotamente.

O MVP solicitado é exclusivamente Quatro em Linha: interface existente → adaptador de salas → autenticação anônima e comunicação → operação autoritativa PostgreSQL → estado de sala restrito por RLS → atualização Realtime. Identidade vem da sessão autenticada, não do código da sala nem de um playerId arbitrário enviado pelo cliente.

Separar interfaces de salas, identidade, conexão, eventos e encerramento. O motor local continua independente da rede. Backend deve impor dois lugares, atomicidade/lock da sala, versão esperada, deduplicação por identificador de comando, coluna/turno válidos, vitória/empate e consentimento de revanche. Cliente não grava tabuleiro/vencedor/placar diretamente. Autorização deve existir também nas operações privilegiadas.

Sem configuração/saúde verificada, o botão Online permanece oculto. Migração, instruções, variáveis públicas de URL/chave publishable e limitações acompanham a entrega. Não incluir segredo em VITE ou bundle. Os testes SQL locais não substituem testes reais de Auth, Realtime, duas conexões e concorrência; consulte `RELATORIO_IMPLEMENTACAO_V13.md` para estado dos critérios.

Para jogos de ação futuros, documentar separadamente servidor autoritativo, relógio/ticks, sequência de entradas, snapshots, reconciliação/interpolação, limites de latência e recuperação. Não implementar essa expansão nesta V13.

## Plano de fases e validação

A: referência/arquitetura/testes. B: investigar defeitos e corrigir casos confirmados com regressões. C: menu/modos/dificuldade/HUD/resultados sem remover sistemas. D: sala privada e Quatro em Linha autoritativo com segurança e integração.

Após cada conjunto: typecheck, lint, testes apropriados e build. Testes de navegador, banco real, mocks e inspeção estática serão registrados separadamente. Verificar hashes V12 na entrega. Não publicar ou fazer push sem autorização.
