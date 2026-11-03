import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/ (jogos em pedaços carregados sob demanda)
// `npm run build:single` -> dist-single/index.html (tudo num arquivo, para publicação simples)
export default defineConfig(({ mode }) => ({
  base: './',
  // Data/hora da versão (horário de Brasília), mostrada nas Configurações da sinuca para conferir se o celular atualizou.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) },
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}));
