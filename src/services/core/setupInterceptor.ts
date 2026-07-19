import { AxiosInstance, AxiosError } from 'axios';
import { getTenantSlug, getSubdomainSlug } from '@/services/core/tenant';

interface SetupInterceptorOptions {
  // 'app'  => X-Tenant ciente do Modo Cliente (padrão, telas do cliente)
  // 'auth' => X-Tenant sempre do subdomínio real (login/refresh/validate)
  authScope?: 'app' | 'auth';
}

// Applied to all API instances to handle 503 SETUP_REQUIRED responses.
// Dispatches a custom event consumed by RouterGuard, which calls logout()
// and navigate() through React context — avoids full-page reloads and
// conflicts with the session_expired interceptor in api.ts.

// Module-level flag prevents multiple concurrent 503s from firing redundant
// events and suppresses ghost error toasts on parallel in-flight requests.
let isDispatching = false;

export function applySetupInterceptor(instance: AxiosInstance, opts: SetupInterceptorOptions = {}): void {
  const resolveSlug = opts.authScope === 'auth' ? getSubdomainSlug : getTenantSlug;
  // SaaS multi-tenant: injeta X-Tenant em TODA requisição. Casa com o
  // TenantResolution do backend. Sem tenant (apex/localhost) não manda nada =>
  // schema public/legado. Escopo 'app' respeita o Modo Cliente; 'auth' não.
  instance.interceptors.request.use(config => {
    const tenant = resolveSlug();
    if (tenant) {
      config.headers.set?.('X-Tenant', tenant);
      (config.headers as Record<string, unknown>)['X-Tenant'] = tenant;
    }
    return config;
  });

  instance.interceptors.response.use(
    response => {
      // Reset flag when any successful response arrives — the server is healthy
      // again, so the next SETUP_REQUIRED event should trigger a redirect.
      isDispatching = false;
      return response;
    },
    (error: AxiosError) => {
      const isSetupRequired =
        error.response?.status === 503 &&
        (error.response.data as { code?: string }).code === 'SETUP_REQUIRED';

      const safePaths = ['/login', '/auth', '/onboarding'];
      const onSafePath = safePaths.some(p => window.location.pathname.startsWith(p));

      if (isSetupRequired && !onSafePath && !isDispatching) {
        isDispatching = true;
        window.dispatchEvent(new CustomEvent('setup:required'));
        return new Promise(() => {});
      }

      return Promise.reject(error);
    },
  );
}
