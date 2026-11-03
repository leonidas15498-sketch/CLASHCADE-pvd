# Relatório de implementação Clashcade V13

**Status da entrega: parcial.** A evolução local V13 foi criada, validada e empacotável. O MVP online de Quatro em Linha tem migração e cliente implementados, porém não foi possível validar dois clientes reais: não há projeto Supabase configurado/conectado. Não declarar o critério online de aceitação concluído.

## Fases e proteção

V13 é uma cópia independente de `clashcade-fonte-v12/plataforma/`; V12 não foi editada. Não havia Git nos locais inspecionados, então não foi criada branch. `V12_REFERENCE_HASHES.json` preserva hashes de 218 arquivos da referência; a comparação SHA-256 final encontrou zero divergências. APK da JindoBlu e arquivos externos não foram copiados.

Fase A documentou arquitetura e regras em `ARQUITETURA_CLASHCADE.md` e `AGENTS.md`, inspecionou jogos, componentes, serviços, testes, Cloudflare e dependências. Linha de base executada na V12: 218 testes/22 arquivos aprovados, typecheck e lint aprovados.

## Alterações

### B — jogabilidade confirmada

- Pong agora processa o movimento do jogador nos passos físicos fixos e captura o ponteiro; parâmetros físicos e três níveis de IA foram preservados.
- Duelo de Rastros preserva a curva inicial de movimento se a fila de controles enche; o desenho usa escala fracionária para evitar pixelização adicional sem alterar a grade de colisão.
- Torre não encerra a rodada apenas por atingir sete segundos enquanto ainda há movimento; a fase de queda usa acumulador fixo.
- Minigolfe revalida o estado após a estabilização de bola deslocada aos limites do campo.
- Sinuca limita a interpolação visual a um intervalo válido.

### C — interface

- Home ganhou filtros de modo, indicadores de disponibilidade e cartões responsivos/foco visível.
- HUD compartilhado identifica jogadores e explica os três níveis de IA; ajustes de quebra de linha para telas estreitas.
- Foram alinhados os caminhos de nova partida, revanche e retorno ao portal nos resultados compartilhados, Sinuca e Minigolfe.
- Cache de service worker renomeado para V13, mantendo limpeza restrita ao prefixo próprio.
- Verificação de navegador automatizada via Edge/CDP: 43 cenários anteriormente concluídos sem erros (rotas, dez jogos, modos exibidos, pausa, foco, seleção e rollback de montagem). A prova foi executada antes dos ajustes finais de protocolo online; não foi um teste visual humano nem valida integração Supabase.

### D — Quatro em Linha online

Cliente modular em `src/services/online/` e `src/games/connect4/online.ts`, com criação/entrada por código, reconexão por identidade anônima persistida, handshake de prontidão, presença, turnos, vitória/empate, revanche por consentimento e saída. A opção só aparece quando o endpoint de saúde Supabase responde.

A migração `supabase/migrations/20261102205003_clashcade_connect4_online.sql` delega criação, entrada, jogada e resultado a comandos transacionais PostgreSQL. RLS permite leitura apenas a participantes; escrita direta é revogada; funções verificam identidade autenticada, turno, versão/rodada, coluna, capacidade, concorrência e deduplicação. Regras e configuração estão em `PLANO_MULTIPLAYER_ONLINE.md` e `CONFIGURACAO_SUPABASE.md`. O navegador não envia placar ou tabuleiro como autoridade. Sem projeto remoto, JWT/Auth, RLS remoto, Realtime multi sessão e segurança ponta a ponta continuam pendentes.

## Validação executada

| Verificação | Resultado |
|---|---|
| Base V12 | 218 testes em 22 arquivos; typecheck e lint, aprovados |
| TypeScript V13 | `npm.cmd run typecheck`, aprovado na execução final |
| ESLint V13 | `npm.cmd run lint`, aprovado na execução final |
| Vitest V13 | 235 testes em 76 suítes, aprovados (ver relatório JSON em `qa/v13-vitest-final.json`) |
| Build V13 | `npm.cmd run build`, aprovado; 164 módulos; saída em `dist/` |
| SQL | 13 testes com PGlite/PostgreSQL local passaram; não substituem integração multi sessão Supabase |
| Navegador | 43 cenários automatizados Edge/CDP passaram; sem validação manual/humana de aparência |
| Publicação remota | Não realizada |

Uma tentativa redundante da suíte no sandbox limitado falhou antes de carregar o Vite por acesso negado ao diretório ancestral. A suíte completa foi repetida com a execução autorizada e passou. Essa falha ambiental não é tratada como teste aprovado.

## Funcionalidades preservadas e limites

Os dez jogos continuam registrados: Sinuca, Minigolfe, Air Hockey, Duelo de Rastros, Torre de Bichinhos/Empilha, Quatro em Linha, Pong, Blocos Cromáticos, Sumô Neon e Cabo de Guerra. Modos locais, IA e níveis existentes foram mantidos; economia, cosméticos, torneios, desafios e dados salvos não foram removidos. Nenhuma vantagem paga ou recompensa competitiva online foi introduzida.

Os critérios de compilação, suíte automatizada, disponibilidade dos dez jogos e viabilidade de build estático foram atendidos. **Não atendido:** Quatro em Linha online real em dois dispositivos e rejeição de jogadas inválidas por backend remoto. Antes de classificar V13 como concluída, configurar projeto Supabase, aplicar migração, validar Auth/RLS/Realtime e executar a matriz de 14 cenários de integração em dois clientes. O arquivo ZIP Cloudflare será build local sem variáveis Supabase; a interface online fica oculta até configurar endpoint/chave pública e reconstruir. Não houve publicação.

## Riscos e próximos passos

1. Criar/configurar projeto Supabase e revisar migração/políticas no ambiente alvo; só então executar testes reais de dois clientes, corrida em sessões separadas, desconexão e reconexão.
2. Verificar compatibilidade de Auth anônimo, proteção contra abuso e retenção/limpeza de salas no plano operacional.
3. Fazer revisão manual visual em celulares reais, sobretudo HUD, botões de resultado e acessibilidade/toque.
4. Planejar sincronização autoritativa própria para Air Hockey, Pong e Sinuca antes de oferecer online nesses jogos; esta V13 não implementa isso.

## Pacotes gerados

- `CLASHCADE_V13_FONTE.zip`: fonte/documentação/testes com a pasta `plataforma/` no arquivo; sem `node_modules`, `dist`, caches, perfil de navegador, `.env` local ou APK.
- `CLASHCADE_V13_CLOUDFLARE.zip`: conteúdo compilado de `dist` diretamente na raiz do ZIP; inclui `index.html`, `assets/`, ícones, manifesto, service worker e demais arquivos públicos. Não contém fonte, testes ou dependências.

Ambos foram inspecionados após geração. O ZIP fonte tinha 236 arquivos. O ZIP de publicação tinha 31 arquivos e `index.html` na raiz. O build foi feito sem credenciais Supabase, portanto o modo Online permanece desabilitado nesse pacote até a configuração de ambiente e uma nova compilação. Nenhuma publicação ocorreu.
