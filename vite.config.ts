import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/ (jogos em pedaços carregados sob demanda)
// `npm run build:single` -> dist-single/index.html (tudo num arquivo, para publicação simples)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}));
