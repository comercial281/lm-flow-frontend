// ════════════════════════════════════════════════════════════════════════════
// Prefetch de chunk de rota — utilitário compartilhado (hoje: só o idle warm-up
// em src/hooks/useRoutePrefetch.ts; dá pra plugar hover/focus depois do mesmo
// jeito, sem duplicar lógica).
// ----------------------------------------------------------------------------
// Só dispara o import() (com retry — mesmo mecanismo do lazyWithRetry) uma vez
// por path, por sessão de página. Repetir prefetchRoute pro mesmo path é
// barato (early-return pelo Set).
// ════════════════════════════════════════════════════════════════════════════
import { routePrefetchMap } from '@/routes/lazyPages';

const prefetchedPaths = new Set<string>();

/**
 * Acha a função de import certa pro path. Casa exato primeiro; se não achar
 * (rota com parâmetro dinâmico, ex: /contacts/:id ou /dashboard-app/:appId),
 * cai pro prefixo registrado mais específico (ex: /contacts/123 -> /contacts).
 */
function resolveImportFn(path: string): (() => Promise<unknown>) | undefined {
  const exact = routePrefetchMap[path];
  if (exact) return exact;

  let bestKey: string | undefined;
  for (const key of Object.keys(routePrefetchMap)) {
    if (path === key || path.startsWith(`${key}/`)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  return bestKey ? routePrefetchMap[bestKey] : undefined;
}

/**
 * Dispara o download do chunk daquela rota em background, se ainda não foi
 * baixado nesta sessão. Nunca lança — se o chunk falhar (offline, 404
 * pós-deploy), o clique real do usuário no link é quem trata o erro (via
 * lazyWithRetry/Suspense), aqui é só uma tentativa antecipada silenciosa.
 */
export function prefetchRoute(path: string | undefined | null): void {
  if (!path || path === '#' || prefetchedPaths.has(path)) return;

  const importFn = resolveImportFn(path);
  if (!importFn) return;

  prefetchedPaths.add(path);
  importFn().catch(() => {
    // Silencioso de propósito — ver comentário acima.
  });
}
