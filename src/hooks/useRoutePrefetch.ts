import { useEffect, useRef } from 'react';
import { CUSTOMER_IDLE_PREFETCH_PATHS } from '@/routes/lazyPages';
import { prefetchRoute } from '@/utils/routePrefetch';

// Intervalo entre cada import() da fila ociosa. Escalonado pra não competir
// com requisições reais de rede que a tela recém-montada ainda esteja fazendo
// (auth, permissões, dados do dashboard, etc.) — baixar ~30 chunks de uma vez
// pioraria a experiência em vez de ajudar.
const STAGGER_MS = 200;

/**
 * Prefetch de rotas (idle warm-up): assim que o usuário está autenticado e o
 * MainLayout já montou, baixa em background — via requestIdleCallback
 * (fallback setTimeout em navegadores sem suporte, ex: Safari) — o chunk JS
 * de cada página do menu principal, uma a uma, com um pequeno atraso entre
 * elas.
 *
 * Resultado: quando o usuário clica em qualquer item do menu, o chunk já
 * costuma estar no cache do navegador, então o Suspense fallback do Outlet
 * compartilhado (ver src/routes/index.tsx) quase nunca chega a aparecer.
 *
 * Roda só 1x por montagem (StrictMode-safe via ref) e cancela os timers
 * pendentes se o componente desmontar.
 */
export function useRoutePrefetch(enabled: boolean): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idleHandle: number | null = null;

    const runQueue = () => {
      CUSTOMER_IDLE_PREFETCH_PATHS.forEach((path, index) => {
        const timer = setTimeout(() => {
          if (cancelled) return;
          prefetchRoute(path);
        }, index * STAGGER_MS);
        timers.push(timer);
      });
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(runQueue, { timeout: 3000 });
    } else {
      // Safari/navegadores sem requestIdleCallback: adia 1 tick pra não
      // competir com o primeiro paint/render da tela.
      timers.push(setTimeout(runQueue, 1));
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [enabled]);
}
