import { createRoot } from 'react-dom/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — virtual module gerado pelo vite-plugin-pwa em build
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import "@evoapi/design-system/styles";
import './styles/globals.css';
import './i18n/config'; // Importar configuração do i18n
import App from './App.tsx';
import { consumeMasterSso } from './utils/masterSso';
import { initTheme } from './utils/themeUtils';
import { initGA4 } from './utils/ga4Utils';
import { reloadForNewVersion } from './utils/chunkReload';
import * as Sentry from '@sentry/react';

// Registra o Service Worker PWA.
// Aba aberta há horas NÃO pega deploy novo sozinha (o build em memória continua
// o antigo até um reload) — era a causa de "essa aba não loga / sumiu o olho":
// JS pré-fix preso. Checamos update a cada 60s + ao voltar o foco pra aba.
//
// IMPORTANTE: registerType:'prompt' (não 'autoUpdate') — a lib NÃO dá
// window.location.reload() sozinha assim que acha versão nova. Isso já
// interrompeu o usuário no meio do uso (aba recarregava sem aviso, perdendo
// o que estava fazendo). A versão nova é aplicada: (1) na hora, se o usuário
// clicar em "Atualizar agora" no aviso; ou (2) sozinha, sem incomodar
// ninguém, na próxima vez que a aba for pra segundo plano (visibilitychange
// -> hidden) — garante que ninguém fica preso em bundle velho por muito
// tempo sem nunca forçar um reload enquanto a pessoa está de fato usando.
if ('serviceWorker' in navigator) {
  let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
  let updateAvailable = false;

  const applyUpdateNow = () => {
    if (!updateAvailable || !applyUpdate) return;
    updateAvailable = false;
    void applyUpdate(true);
  };

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable = true;
      toast('Nova versão do LM Flow disponível', {
        id: 'lm-flow-sw-update',
        duration: Infinity,
        description: 'Atualiza sozinho quando você sair desta aba, ou clique pra já pegar agora.',
        action: {
          label: 'Atualizar agora',
          onClick: applyUpdateNow,
        },
      });
    },
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      const checkForUpdate = () => {
        registration.update().catch(() => {
          /* offline / falha de rede: ignora, tenta de novo no próximo ciclo */
        });
      };
      setInterval(checkForUpdate, 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        } else if (updateAvailable) {
          // Aba foi pra segundo plano com update pendente: aplica agora,
          // fora da hora em que a pessoa está de fato olhando a tela.
          applyUpdateNow();
        }
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
