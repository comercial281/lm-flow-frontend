// ════════════════════════════════════════════════════════════════════════════
// Protocolo "nova versão sem tela de erro" (chunk reload) — LM Flow
// ----------------------------------------------------------------------------
// Deploy novo troca os hashes dos chunks. Aba aberta com o index.html antigo
// tenta importar um chunk que sumiu -> 404 -> tela de erro ao trocar de tela.
// No LM Flow tem PWA (Service Worker): o SW serve o index.html velho, entao
// alem de recarregar precisamos matar o SW + caches, senao recarrega no mesmo
// HTML velho. Tudo com trava anti-loop compartilhada (mesma chave do main.tsx).
//
// Usado por: lazyWithRetry (routes/Chat), ErrorBoundary, main.tsx (preloadError).
// ════════════════════════════════════════════════════════════════════════════
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'lm_chunk_reloaded';
const RELOAD_WINDOW_MS = 30_000;

const CHUNK_ERROR_RE =
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css|dynamically imported module|loading chunk \d+ failed|loading css chunk|failed to import/i;

export function isChunkError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  return CHUNK_ERROR_RE.test(msg);
}

/**
 * Recarrega pra pegar o bundle novo. No máximo 1x por janela (anti-loop).
 * Mata o Service Worker + caches antes (eles servem o index.html velho).
 * @returns true se disparou o reload; false se foi suprimido pela trava.
 */
export async function reloadForNewVersion(): Promise<boolean> {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
  } catch {
    /* storage off */
  }
  if (Date.now() - last < RELOAD_WINDOW_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* segue pro reload de qualquer forma */
  }
  window.location.reload();
  return true;
}

/** Envolve um import dinâmico: em erro de chunk recarrega e segura o Suspense. */
export function retryImport<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch(async (err) => {
    if (isChunkError(err)) {
      const reloaded = await reloadForNewVersion();
      if (reloaded) return new Promise<T>(() => {});
    }
    throw err;
  });
}

/** Componente lazy com a função de import original anexada (ver lazyWithRetry). */
export type PreloadableLazyComponent<T extends ComponentType<unknown>> = LazyExoticComponent<T> & {
  /** Dispara o mesmo import() (com retry) sem renderizar — usado pra prefetch de rota. */
  __preload: () => Promise<unknown>;
};

/**
 * Igual ao React.lazy, mas com auto-recuperação de chunk faltante — e expõe a
 * função de import original em `__preload`, pra permitir prefetch (idle) do
 * mesmo chunk sem duplicar o import() em outro arquivo (ver
 * src/routes/lazyPages.ts e src/utils/routePrefetch.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- espelha a assinatura do React.lazy
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): PreloadableLazyComponent<T> {
  const preload = () => retryImport(factory);
  const Component = lazy(preload) as PreloadableLazyComponent<T>;
  Component.__preload = preload;
  return Component;
}
