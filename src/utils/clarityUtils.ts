/**
 * Microsoft Clarity Analytics Integration
 *
 * Initializes Microsoft Clarity for user behavior analytics.
 * Reads project ID from backend API (via GlobalConfigContext) with VITE_CLARITY_PROJECT_ID as fallback.
 * Only runs in production with a valid project ID.
 */

declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
  }
}

export const mascararTelaNoClarity = (): void => {
  document.body?.setAttribute('data-clarity-mask', 'True');
};

export const initClarity = (configProjectId?: string | null): void => {
  const projectId = configProjectId || import.meta.env.VITE_CLARITY_PROJECT_ID;

  if (!projectId) return;

  // O CRM mostra nome, telefone e conversa de lead: com o Clarity ligado, a tela
  // inteira sai mascarada na gravação (auditoria 3E-13, 12/11/2026). Fica o
  // desenho da página e os cliques, nunca o texto. Não tirar sem o dono pedir.
  mascararTelaNoClarity();

  // Only initialize in production with valid project ID
  if (import.meta.env.DEV) {
    return;
  }

  // Skip if Clarity is already initialized
  if (window.clarity) {
    return;
  }

  try {
    // Microsoft Clarity initialization script
    (function (
      c: any,
      l: Document,
      a: string,
      r: string,
      i: string,
      t?: HTMLScriptElement,
      y?: Element | null,
    ) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      if (y && y.parentNode) {
        y.parentNode.insertBefore(t, y);
      }
    })(window, document, 'clarity', 'script', projectId);
  } catch (error) {
    console.error('Clarity: Initialization failed', error);
  }
};

/**
 * Track custom events in Clarity
 */
export const clarityEvent = (eventName: string, ...args: any[]): void => {
  if (window.clarity) {
    window.clarity('event', eventName, ...args);
  }
};

/**
 * Set custom tags in Clarity
 */
export const clarityTag = (key: string, value: string): void => {
  if (window.clarity) {
    window.clarity('set', key, value);
  }
};

/**
 * Identify user in Clarity
 */
export const clarifyIdentify = (userId: string, customData?: Record<string, string>): void => {
  if (window.clarity) {
    window.clarity('identify', userId, customData);
  }
};
