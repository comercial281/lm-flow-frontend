import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // usamos o public/manifest.json manualmente
      workbox: {
        // NÃO precachear index.html: senão o SW serve o HTML antigo do cache, que
        // referencia chunks /assets/index-*.js já substituídos por um deploy novo
        // (404 → tela branca). HTML sempre vem da rede; só assets estáticos cacheiam.
        globPatterns: ['**/*.{css,ico,png,svg,woff2}'],
        importScripts: ['/push-sw.js'],
        navigateFallback: null,
        cleanupOutdatedCaches: true, // remove precache de versões antigas na ativação
        clientsClaim: true, // assume o controle das abas abertas imediatamente
        skipWaiting: true, // ativa o SW novo na hora (não espera fechar todas as abas)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      },
      devOptions: {
        enabled: false, // desliga em dev (evita conflito com HMR)
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    },
    hmr: {
      overlay: false,
    },
    fs: {
      strict: false,
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@evoapi/design-system',
      'lucide-react',
      'sonner',
      'zustand',
    ],
    force: true,
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
