# Multiplayer online — plano e estado da V13

## Escopo

Somente Quatro em Linha. Preservar o jogo local, sua IA e o renderer Canvas; adicionar adaptador de sala sem impor rede aos outros nove jogos. A infraestrutura usa Supabase Auth anônimo, PostgreSQL autoritativo e Realtime Postgres Changes.

## Separação implementada

| Camada | Arquivos e responsabilidade |
|---|---|
| Interface | `src/games/connect4/online.ts`: formulário de sala, código, estado de conexão, J1/J2, saída e adaptação de snapshot para o renderer existente |
| Regras locais | `src/games/connect4/logic.ts`: motor original preservado; IA em ai.ts; sem dependência Supabase |
| Integração com o jogo | `src/games/connect4/index.ts`: encaminha jogadas online, desenha somente snapshots autoritativos e usa resultados do backend |
| Contratos | `src/services/online/types.ts`: sala, identidade, conexão, eventos, encerramento e validação do payload |
| Rede/Auth | `src/services/online/supabaseRooms.ts`: cliente configurável, sessão anônima, RPC, assinatura, heartbeat e reconexão |
| Persistência e autoridade | `supabase/migrations/20261102205003_clashcade_connect4_online.sql`: sala, ledger de comandos, RLS, grants, locks e decisão de resultados |

## Protocolo de sala

1. `create`: servidor gera UUID/código e reserva J1 da identidade autenticada.
2. `join`: código encontra sala; operação trava a linha e preenche somente uma vaga J2. Código não autoriza leitura/escrita de outras salas.
3. `ready`: cada identidade confirma a assinatura; só depois das duas confirmações e presença recente o servidor inicia.
4. `move`: recebe somente sala, coluna, versão, rodada e UUID do comando. Ator vem de `auth.uid()`. Servidor verifica status/presença/turno/coluna/altura, aplica gravidade e calcula vitória/empate.
5. `heartbeat`/`resume`: recuperam snapshot autorizado e atualizam presença; token anônimo persistido permite retomar no mesmo perfil.
6. `rematch`: duas confirmações independentes após conclusão; mantém placar, alterna primeiro jogador e incrementa rodada.
7. `leave`: encerra sem conceder vitória. Desmontar por navegação inesperada apenas desconecta; permite reconexão posterior.

Cada mutação importante é deduplicada por identidade + UUID de comando + argumentos. Um advisory lock serializa retries, e `FOR UPDATE` serializa operações sobre a sala. Versão/rodada recusam comandos atrasados. Cliente ignora snapshots anteriores à versão já recebida.

## Autoridade e segurança

- Tabela pública tem SELECT limitado por RLS a J1/J2 e nenhum grant de escrita ao cliente.
- Operação privilegiada fica em schema privado não exposto, com search_path vazio, grants explícitos e verificação de identidade/participação em todos os caminhos.
- Wrapper público é SECURITY INVOKER. Código não aceita estado/vencedor/placar arbitrários como argumentos.
- Sessão autenticada determina a vaga; terceiro participante, colunas inválidas e turno incorreto são recusados no backend.
- Revanche nunca depende de consentimento enviado em nome do outro jogador.
- Nenhuma service role/secret/admin key no frontend. Somente URL e publishable key via ambiente.
- Sem ranking competitivo e sem recompensa de moedas online controlada pelo navegador.

## Conexão e encerramento

O cliente mantém estados connecting/connected/reconnecting/disconnected/closed, limpa assinatura/timers na saída e persiste apenas a referência da última sala além da sessão Auth do SDK. Heartbeat de dez segundos; presença expira após 35 segundos. Desconexão não cria vitória por abandono. Realtime retomado e nova leitura do servidor reconciliam o estado.

Pausa local não congela partida remota: botão de pausa do Shell fica oculto durante online. Sair do menu ou da sala é explícito; o backend mantém o controle do resultado. Preferências locais e economia não dependem do online.

## Validação e pendências

Há testes da migração executados em PostgreSQL/WASM com RLS e roles reais locais. Apenas `auth.uid()` e os usuários de teste são fornecidos pelo fixture local. Isso valida SQL/permissões/regras, mas **não** valida Supabase Auth, assinatura Realtime hospedada, JWT real, dois navegadores pela internet ou contenção de locks entre duas conexões PostgreSQL reais. PGlite enfileira uma conexão; o caso de comandos simultaneamente enfileirados verifica rejeição por versão, não latência/contenção distribuída.

A conexão Supabase disponível nesta sessão retornou zero projetos. Nenhum projeto remoto foi criado e nenhuma migração foi aplicada remotamente. A entrega é parcial até executar os 14 cenários obrigatórios com dois clientes e um projeto configurado. A configuração detalhada e o roteiro estão em CONFIGURACAO_SUPABASE.md.

## Expansão futura — documentada, não implementada

Para Pong, Air Hockey e Sinuca, não enviar estado Canvas a cada frame nem confiar no navegador anfitrião como autoridade final. Avaliar servidor dedicado/Worker com coordenação de sala, ticks fixos, sequência de entradas, snapshots carimbados, interpolação e reconciliação. Medir RTT/jitter e determinar limites aceitáveis antes de escolher frequência de simulação/replicação. Validar física e regras no servidor; preservar motores atuais e separar o renderer.

Realtime de banco serve bem ao ritmo por turnos deste MVP, mas não deve ser assumido como transporte adequado à física em alta frequência. Planejar tratamento de reconexão, versionamento do protocolo, limites de salas, proteção de abuso e custo antes da expansão. Nada disso foi implementado para os demais jogos nesta V13.
