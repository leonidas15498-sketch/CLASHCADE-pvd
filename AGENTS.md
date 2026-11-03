# Clashcade V13 — regras de preservação

- Trabalhar somente nesta cópia V13. V11 e V12 são referências imutáveis. Não sobrescrever ZIPs estáveis.
- Continuar o projeto existente: manter React, TypeScript, Vite, Canvas 2D e motores atuais. Não reconstruir jogos.
- Preservar dez jogos, modos locais/solo/IA realmente disponíveis, três dificuldades nos jogos com IA, músicas, efeitos, idiomas e dados salvos.
- Preservar catálogo, moedas, desafios, sessão e torneios. Cosméticos Premium nunca alteram física, força da IA ou chances de vitória.
- Não copiar código, imagens, áudio ou recursos da JindoBlu.
- Mudanças de regras ou parâmetros exigem problema reproduzido ou justificativa explícita, teste de regressão e registro. Preservar especialmente o motor da Sinuca.
- Manter regras e física separadas de interface e rede. Reutilizar o motor do Quatro em Linha; não impor uma abstração genérica aos dez jogos.
- Seguir mount/destroy e onMountRollback; cada listener, timer, animação, observador e assinatura de rede precisa de encerramento.
- Preservar as correções V12 de hash, persistência, pausa/confirmação, foco, rollback, áudio e isolamento de cache.
- Online inicial somente no Quatro em Linha. Não anunciar modo pronto se serviço/configuração/saúde não foram verificados.
- Backend valida identidade, participação, turno, coluna, versão, vitória, empate, placar e revanche numa operação concorrente segura. Nunca aceitar tabuleiro/vencedor/placar arbitrários do cliente.
- RLS restringe salas a seus participantes; código de convite não substitui autenticação/autorização. Limite de dois participantes imposto no banco.
- Não usar credenciais secretas ou service role no frontend. Variáveis VITE são públicas. Não inventar credenciais e não publicar sem instrução explícita.
- Não criar ranking competitivo nem serviços comerciais nesta etapa. Não aplicar migrações em projeto remoto não identificado.
- Após cada fase: TypeScript, ESLint, testes apropriados e build. Diferenciar testes locais, mocks, integração real, navegador e inspeção estática.
- Documentar falhas e pendências sem afirmar aprovação não executada. Não instalar dependências globais. Novas dependências locais devem ser justificadas e fixadas no lockfile.
- Antes da entrega, conferir hashes da referência V12 e listar arquivos alterados. Não descartar trabalho do usuário nem fazer push.

As instruções do usuário prevalecem sobre este arquivo. Consulte ARQUITETURA_CLASHCADE.md antes de alterar serviços compartilhados.
