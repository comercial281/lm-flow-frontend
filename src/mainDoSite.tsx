// O site do cliente no domínio dele (www.imobiliaria.com.br). Quem decide que é
// este o app é src/main.tsx.
//
// ARMADILHA: nada do CRM aqui. Sem AuthProvider, sem store de sessão (não lê o
// `access_token`, não chama a checagem de sessão), sem websocket, sem service
// worker do PWA, sem i18n do app e sem o SSO do admin. Só o estilo e o site.
import { createRoot } from 'react-dom/client';
import '@evoapi/design-system/styles';
import './styles/globals.css';
import SiteDoDominioApp from './routes/SiteDoDominio';
import { reloadForNewVersion } from './utils/chunkReload';

// Deploy novo trocou o nome de um pedaço do site já aberto: recarrega (com a
// mesma trava anti-laço do CRM).
window.addEventListener('vite:preloadError', () => {
  void reloadForNewVersion();
});

if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.0,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.0,
    });
  });
}

createRoot(document.getElementById('root')!).render(<SiteDoDominioApp />);
