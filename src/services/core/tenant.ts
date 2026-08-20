// Resolução de tenant (apartamento) no frontend a partir do subdomínio.
//
//   renato.lmflow.com.br  -> "renato"  (manda X-Tenant: renato pro backend)
//   lmflow.com.br (apex)  -> null      (schema public / térreo / cadastro)
//   localhost / *.vercel.app (preview) -> override por ?tenant= ou
//                                          localStorage('x-tenant') pra testes
//
// Casa com o TenantResolution do backend (header X-Tenant ou subdomínio).

import { getClientModeSlug } from '@/store/clientModeStore';

const PROD_DOMAIN = 'lmflow.com.br';
const RESERVED = new Set([
  'www', 'app', 'api', 'admin', 'staging', 'production', 'localhost', 'lmflow',
]);

// Slug REAL do subdomínio (contexto do host). NÃO considera Modo Cliente.
// Usado pelo fluxo de auth (login/refresh/validate), que sempre opera na raiz.
export function getSubdomainSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();

  if (host === PROD_DOMAIN || host.endsWith(`.${PROD_DOMAIN}`)) {
    if (host === PROD_DOMAIN) return null; // apex = sem tenant
    const sub = host.slice(0, -(PROD_DOMAIN.length + 1)); // tira ".lmflow.com.br"
    const first = sub.split('.')[0];
    if (!first || RESERVED.has(first)) return null;
    return first;
  }

  // Ambiente de teste (localhost / preview): permite forçar o tenant
  try {
    const qp = new URLSearchParams(window.location.search).get('tenant');
    if (qp) return qp.toLowerCase();
    const ls = window.localStorage.getItem('x-tenant');
    if (ls) return ls.toLowerCase();
  } catch {
    // localStorage indisponível — ignora
  }
  return null;
}

// Slug EFETIVO usado nas requisições do APP. Em Modo Cliente (super-admin),
// vence o cliente selecionado; senão, cai no subdomínio real.
export function getTenantSlug(): string | null {
  const forced = getClientModeSlug();
  if (forced) return forced;
  return getSubdomainSlug();
}
