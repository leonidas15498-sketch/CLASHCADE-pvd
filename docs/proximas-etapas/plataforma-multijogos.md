COMPLEMENTO OBRIGATÓRIO — PLATAFORMA MULTIJOGOS

1. CONTEXTO GERAL

O Minigolfe não será um aplicativo independente.

Ele fará parte de uma plataforma web de minijogos casuais e competitivos, inspirada na experiência do aplicativo 2 Player Games: The Challenge, mas com identidade visual e jogos autorais.

A plataforma terá um menu principal que permitirá escolher entre vários jogos, todos acessíveis pelo mesmo site.

Os dois primeiros jogos previstos são:

1. Sinuca 8-Ball.
2. Minigolfe.

Futuramente, serão adicionados outros jogos, como Air Hockey, Duelo de Rastros, Torre Perfeita e jogos de raciocínio.

Não implementar esses jogos futuros nesta etapa.

2. MENU PRINCIPAL

Criar uma página inicial com:

- Identidade visual própria da plataforma.
- Nome e logotipo provisórios.
- Catálogo de jogos em cartões visuais.
- Imagem de capa de cada jogo.
- Nome e descrição resumida.
- Indicação das modalidades disponíveis.
- Botão para iniciar cada jogo disponível.
- Identificação dos jogos em desenvolvimento.
- Navegação intuitiva.
- Interface responsiva para celular e computador.

Catálogo inicial

Sinuca 8-Ball

- Modalidade 1P contra IA.
- Modalidade 2P local.
- Regras de sinuca 8-Ball.
- Física realista.
- Mira e barra de força.

Minigolfe

- Modalidade 1P.
- Modalidade 2P local por turnos.
- Circuitos progressivos.
- Física consistente.
- Mira e barra de força.

Cada cartão deverá abrir a tela específica do jogo.

Não apresentar jogos indisponíveis como funcionais.

3. ARQUITETURA COMPARTILHADA

Utilizar uma única aplicação React + TypeScript + Vite.

Os jogos deverão ser módulos independentes dentro da mesma aplicação.

Estrutura sugerida:

src/
├── app/
├── components/
├── pages/
│   ├── Home/
│   └── GamePage/
├── games/
│   ├── pool/
│   ├── minigolf/
│   └── shared/
├── services/
├── hooks/
├── styles/
└── types/

Criar um registro central de jogos com:

- ID.
- Nome.
- Descrição.
- Imagem.
- Modalidades.
- Status de disponibilidade.
- Rota.
- Módulo de carregamento.

Utilizar carregamento sob demanda para evitar que o usuário precise baixar todos os jogos ao acessar o portal.

Os jogos podem compartilhar componentes de interface, controles, efeitos sonoros e utilitários físicos quando tecnicamente apropriado.

Entretanto, não forçar o compartilhamento de motores físicos quando isso comprometer a qualidade de algum jogo.

4. NAVEGAÇÃO

O fluxo deverá ser:

Menu principal → Escolher jogo → Escolher modalidade → Jogar → Resultado → Revanche ou voltar ao menu.

O usuário deverá conseguir sair de qualquer jogo e retornar ao catálogo.

Antes de abandonar uma partida em andamento, apresentar confirmação quando houver risco de perder progresso.

A navegação entre jogos não deverá exigir recarregamento completo da página.

5. MODALIDADES

Cada jogo poderá oferecer modalidades diferentes.

1P — Solo

O usuário joga sozinho ou contra a IA.

2P — Local

Duas pessoas jogam no mesmo dispositivo.

No caso da Sinuca e do Minigolfe, os jogadores alternam turnos.

Não exigir cadastro ou conexão com a internet para partidas locais.

Multiplayer online

Funcionalidade futura, fora do escopo atual.

Não implementar salas online ou servidores de partidas nesta etapa.

6. DADOS E RECORDES

Inicialmente, utilizar armazenamento local para:

- Preferências.
- Configurações de som.
- Recordes individuais.
- Resultados de partidas quando apropriado.

Preparar interfaces de persistência para futura integração com Supabase.

Não exigir autenticação para começar a jogar.

Não implementar rankings mundiais fictícios.

Partidas entre duas pessoas no mesmo dispositivo não deverão alimentar rankings competitivos globais, pois não existe validação confiável da identidade dos participantes.

7. INTEGRAÇÃO DOS JOGOS

Se o jogo de Sinuca já existir:

- Preservar sua implementação funcional.
- Integrá-lo ao catálogo.
- Reutilizar seus componentes quando apropriado.
- Não reconstruí-lo desnecessariamente.
- Não alterar sua física sem justificativa e testes.

Se a Sinuca ainda não existir:

- Criar o cartão correspondente no catálogo.
- Marcar claramente como "Em desenvolvimento".
- Não simular uma partida funcional.
- Preparar a estrutura para integrar o jogo posteriormente.

O mesmo princípio se aplica ao Minigolfe.

8. REQUISITOS DE QUALIDADE

- Cada jogo deverá funcionar independentemente dentro da plataforma.
- Falhas em um jogo não deverão comprometer os demais.
- Evitar vazamentos de memória ao trocar de jogo.
- Destruir corretamente instâncias de Phaser ou outros motores.
- Remover listeners e animações desnecessárias.
- Garantir navegação responsiva.
- Preservar configurações do usuário.
- Testar entrada e saída dos jogos.
- Executar build de produção.

9. ORDEM DE EXECUÇÃO

1. Inspecionar os arquivos existentes.
2. Identificar se a Sinuca já está implementada.
3. Criar ou adaptar a estrutura da plataforma.
4. Implementar o menu principal.
5. Integrar a Sinuca, se estiver disponível.
6. Implementar o Minigolfe conforme seu prompt específico.
7. Integrar o Minigolfe ao catálogo.
8. Testar navegação, jogos e controles.
9. Documentar a arquitetura e as próximas etapas.

Não apagar nem substituir implementações existentes sem necessidade.

10. RESULTADO ESPERADO

Ao abrir o site, o usuário deverá encontrar um menu com os jogos disponíveis.

Deverá conseguir selecionar Sinuca ou Minigolfe, escolher entre 1P e 2P local, jogar e retornar ao menu principal.

Se um dos jogos ainda não estiver implementado, ele deverá aparecer como indisponível, sem funcionalidades simuladas.

INSTRUÇÃO FINAL

Trate este projeto como uma plataforma comercial de minijogos, e não como um jogo isolado.

O Minigolfe será apenas um dos módulos.

Priorize arquitetura modular, experiência de usuário, desempenho e possibilidade de expansão.

Não implemente funcionalidades futuras desnecessárias antes de concluir e testar os jogos atuais.