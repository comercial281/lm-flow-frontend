import { createRoot } from 'react-dom/client';
import "@evoapi/design-system/styles";
import './styles/globals.css';
import './i18n/config'; // Importar configuração do i18n
import App from './App.tsx';
import { consumeMasterSso } from './utils/masterSso';
import { initTheme } from './utils/themeUtils';
import { initGA4 } from './utils/ga4Utils';
import * as Sentry from '@sentry/react';

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
