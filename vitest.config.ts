import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // `scripts/` entrou porque os portões do build moram lá (conferir-i18n,
    // conferir-caixinhas) e até agora o repositório não conseguia testar os
    // próprios portões — só dava pra conferir à mão, que foi como um deles quase
    // entrou sem nunca ter sido visto reprovando.
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'scripts/**/*.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
