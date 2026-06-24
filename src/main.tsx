import { createRoot } from 'react-dom/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — virtual module gerado pelo vite-plugin-pwa em build
import { registerSW } from 'virtual:pwa-register';
import "@evoapi/design-system/styles";
import './styles/globals.css';
import './i18n/config'; // Importar configuração do i18n
import App from './App.tsx';
import { consumeMasterSso } from './utils/masterSso';
import { initTheme } from './utils/themeUtils';
import { initGA4 } from './utils/ga4Utils';
import { reloadForNewVersion } from './utils/chunkReload';
import * as Sentry from '@sentry/react';

// Registra o Service Worker PWA (atualiza silenciosamente).
// Aba aberta há horas NÃO pega deploy novo sozinha (o build em memória continua
// o antigo até um reload manual) — era a causa de "essa aba não loga / sumiu o
// olho": JS pré-fix preso. Com registerType:'autoUpdate', assim que o SW acha
// uma versão nova ele ativa e recarrega a página. Só faltava DISPARAR a checagem
// em abas de vida longa: fazemos a cada 60s e ao voltar o foco pra aba.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      const checkForUpdate = () => {
        registration.update().catch(() => {
          /* offline / falha de rede: ignora, tenta de novo no próximo ciclo */
        });
      };
      setInterval(checkForUpdate, 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
  });
}

// Rede de segurança global pós-deploy: se um chunk lazy falhar ao carregar
// (hash trocou num deploy novo / SW serve index.html velho -> 404), recarrega
// pra pegar o bundle atual. reloadForNewVersion tem trava anti-loop + mata
// SW/caches. O caminho principal e o lazyWithRetry + ErrorBoundary do app;
// isto cobre o que escapar pela rede. Mesma trava compartilhada (lm_chunk_reloaded).
window.addEventListener('vite:preloadError', () => {
  void reloadForNewVersion();
});

// LM Flow: Sentry React SDK — Story 1.1
// VITE_SENTRY_DSN must be set in Railway environment variables
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Performance tracing disabled at MVP — enable when performance budget defined
    tracesSampleRate: 0.0,
    // Session replay disabled at MVP
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.0,
  });
}

// Master-admin SSO: consome o token do hash ANTES do app subir (loga como master)
consumeMasterSso();

// Inicialização do tema antes do React montar
initTheme();

// Inicialização do Google Analytics 4
initGA4();

// ⚡ OTIMIZAÇÃO: StrictMode removido para evitar duplicação de requests
// Em desenvolvimento, StrictMode executa useEffect 2x para detectar problemas
createRoot(document.getElementById('root')!).render(
    <App />
);
