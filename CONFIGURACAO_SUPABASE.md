# Configuração do online — Clashcade V13

## Estado da entrega

O código e a migração são configuráveis. Nenhum projeto remoto foi criado, alterado ou publicado nesta sessão. A conexão Supabase acessível retornou uma lista vazia. Sem configuração, o site estático e os dez jogos locais continuam disponíveis; o botão Online fica oculto.

Os testes PostgreSQL/WASM executam a migração e as permissões de verdade localmente, mas não validam Auth/Realtime hospedados, JWTs reais, duas conexões PostgreSQL independentes ou internet entre dispositivos. A aceitação do MVP online permanece pendente até a rodada descrita abaixo.

## 1. Preparar um projeto dedicado

1. Crie ou selecione seu projeto Supabase de desenvolvimento. Não use um projeto de produção sem revisar a migração.
2. Habilite autenticação anônima em Authentication. Usuários anônimos autenticados têm o papel `authenticated`, mas só recebem acesso às salas em que ocupam uma vaga.
3. Configure os endereços do site conforme seu domínio de teste/produção. Para exposição pública, configure proteção de abuso/CAPTCHA e limites adequados de Auth/API. Este MVP não implementa um gateway global de rate limiting.
4. Abra o SQL Editor como administrador e aplique, após revisão, `supabase/migrations/20261102205003_clashcade_connect4_online.sql`. A migração cria objetos novos `clashcade_*`; não remove tabelas de outros sistemas. Ela não é um script idempotente para executar repetidamente.
5. Alternativamente, use sua CLI Supabase para aplicar a migração com seu fluxo normal de versionamento. O arquivo foi gerado pela CLI 3.0.0, sem instalação global. Nenhuma senha deve ser adicionada ao código do portal.

O schema `clashcade_private` deve permanecer fora dos schemas expostos pela Data API. O cliente usa somente `public.clashcade_command`, `public.clashcade_online_status` e SELECT limitado por RLS em `public.clashcade_rooms`. Não conceda INSERT, UPDATE ou DELETE da tabela ao navegador.

## 2. Conferir banco e Realtime

Depois de aplicar a migração, confira no SQL Editor:

```sql
select schemaname, tablename, rowsecurity from pg_tables
where schemaname in ('public','clashcade_private')
  and tablename in ('clashcade_rooms','commands');

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies where tablename = 'clashcade_rooms';

select has_table_privilege('authenticated','public.clashcade_rooms','select') as can_read,
       has_table_privilege('authenticated','public.clashcade_rooms','update') as can_write;

select * from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'clashcade_rooms';

select public.clashcade_online_status();
```

Esperado: RLS habilitado; política SELECT restrita aos participantes; `can_read=true`, `can_write=false`; tabela na publicação Realtime; protocolo `1`. Esses são resultados esperados, não consultas remotas executadas nesta sessão.

A migração adiciona a tabela à publicação se `supabase_realtime` já existir. Se seu projeto não tiver essa publicação, habilite Postgres Changes para `public.clashcade_rooms` nas configurações de Realtime/Pipelines e confira novamente. Execute os advisors do projeto e revise avisos de RLS/funções antes de disponibilizar o serviço.

A função privada SECURITY DEFINER tem `search_path` vazio, valida `auth.uid()`, participação, parâmetros, versões e transições. A função pública é SECURITY INVOKER. Não ampliar seus grants nem expor uma função de gravação genérica.

## 3. Configurar somente valores públicos

Copie `.env.example` para `.env.local` dentro de `plataforma` e preencha com valores reais do seu projeto:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use a URL HTTPS do projeto e uma chave **publishable** (`sb_publishable_...`). Os campos estão vazios de propósito: não são credenciais fictícias. O adaptador rejeita chaves de outro formato, incluindo `sb_secret_...`; esta implementação não aceita a antiga chave anon JWT. Nunca coloque service role, chave secreta, senha de banco ou token administrativo em uma variável `VITE_*`.

Valores VITE são incluídos publicamente no bundle. Publique apenas os dois valores públicos; segurança depende de Auth, grants, RLS e validação no backend, não do sigilo desses valores.

Execute `npm.cmd ci`, se necessário, e `npm.cmd run build`. Em ambientes que não usam PowerShell, `npm` é equivalente. O Online aparece no menu do Quatro em Linha somente se URL/chave têm formato válido e a verificação de protocolo do backend responde corretamente. Falhas de Auth/Realtime ao entrar na sala são apresentadas ao usuário; disponibilidade de rede não pode ser garantida pelo build.

## 4. Publicar na Cloudflare Pages

O frontend permanece estático. Não há Functions, Worker ou servidor Node a publicar junto dele. O backend é Supabase separado.

No Direct Upload, as variáveis são resolvidas **antes** da geração do ZIP. Alterar uma variável no painel da Cloudflare não modifica um bundle já compilado e enviado. Configure `.env.local`, gere um novo build e compacte o conteúdo de dist diretamente na raiz de um novo ZIP.

O ZIP de produção entregue nesta sessão não contém credenciais e foi compilado sem configuração Supabase: oferece os modos locais e oculta Online. Não deve ser anunciado como multiplayer online ativo.

## 5. Rodada obrigatória de integração real

Use dois navegadores/perfis isolados ou dois dispositivos com sessões anônimas distintas. Duas abas no mesmo perfil compartilham a identidade e não representam dois jogadores diferentes.

1. No cliente A, abra Quatro em Linha → Online → criar sala; copie o código de dez caracteres.
2. No cliente B, entre pelo código. Confira J1/J2, nomes e início após ambos confirmarem a conexão.
3. Jogue alternadamente e confira que tabuleiro, turno e versão coincidem nos dois clientes.
4. Complete vitória horizontal, vertical e diagonal e uma partida empatada; confira placar calculado pelo backend.
5. Tente jogar fora de turno, em coluna inválida/cheia e repetir um comando; o backend deve rejeitar ou retornar a resposta idempotente, sem aplicar duas peças.
6. Abra um terceiro perfil: entrada na sala cheia deve falhar; SELECT direto da sala sem participar deve retornar zero linhas.
7. Tente gravar tabuleiro, vencedor ou placar pela Data API: deve falhar por falta de privilégio. Não testar com service role, pois ela contorna RLS.
8. Desconecte B durante a partida, aguarde a janela de presença (35 segundos) e confirme bloqueio de novas jogadas e aviso no A. Não há vitória automática por desconexão.
9. Reconecte B no mesmo perfil autenticado; use a reconexão da última sala, confira preservação do estado e retomada. Limpar dados do navegador perde a identidade anônima e não permite assumir a vaga anterior só pelo código.
10. Solicite revanche em A: B precisa consentir. Confira tabuleiro zerado, primeira vez alternada, rodada incrementada e placar preservado. Comandos antigos devem ser recusados pela versão/rodada.
11. Dispare duas jogadas simultâneas com a mesma versão em conexões independentes: no máximo uma deve ser aceita. Repita o mesmo identificador de comando e confira deduplicação.
12. Saia explicitamente da sala: ela deve encerrar sem conceder vitória. Tente voltar ou jogar com estado antigo.

Registre versões, perfis, horários, ações, retornos da API e resultados. Não transformar testes de mocks ou de um PostgreSQL local de conexão única em aprovação dessa rodada.

## 6. Operação e limitações

Salas expiram para novas operações após quatro horas; cada identidade pode manter até cinco salas ativas como anfitriã. Heartbeat ocorre a cada dez segundos. Não há matchmaking público, ranking, moedas online, transferência de conta anônima ou sincronização remota dos cosméticos.

O estado local dos demais sistemas permanece nas chaves existentes. Uma partida online não é relatada como vitória local nem concede fichas pelo cliente. Os cosméticos seguem exclusivamente visuais.

A migração não instala agendamento de limpeza. Configure uma rotina administrativa de retenção após definir a política de dados: apagar comandos antigos e salas expiradas/encerradas. Não conceder essa limpeza ao frontend. Mantenha registros suficientes para deduplicação durante a vida das salas. Exclusão de usuários anônimos também precisa considerar as referências das salas.

## Referências consultadas

- [Changelog Supabase](https://supabase.com/changelog)
- [Proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Autenticação anônima](https://supabase.com/docs/guides/auth/auth-anonymous)

As páginas Markdown retornaram limitações de acesso no navegador de pesquisa; foram usadas a página HTML de changelog e a busca de documentação do conector Supabase. Nenhum segredo foi consultado ou registrado.
