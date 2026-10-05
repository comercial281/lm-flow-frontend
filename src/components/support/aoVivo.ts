import { useEffect, useRef } from 'react';

/**
 * Sinal ao vivo do chat de suporte (desde 04/10/2026, pedido do dono): o servidor
 * avisa "o chamado X mudou" pela ligação ao vivo única do app (useGlobalWebSocket),
 * que repassa aqui como evento de janela. Quem escuta recarrega pela API; a checagem
 * periódica continua de reserva, caso a ligação caia.
 */
export const SUPPORT_LIVE_EVENT = 'lmflow:suporte';

export function avisarSuporte(ticketId?: string): void {
  window.dispatchEvent(new CustomEvent<{ ticketId?: string }>(SUPPORT_LIVE_EVENT, { detail: { ticketId } }));
}

/**
 * Chama `aoMudar(ticketId)` a cada sinal. A função mais recente vale sempre.
 *
 * ⚠️ Aba do navegador escondida: o sinal fica GUARDADO e só é entregue quando a pessoa
 * volta pra aba. Abrir o chamado pela API marca como lido ("abrir = ler"); entregar com
 * a aba em segundo plano apagava o "não lido" de uma mensagem que ninguém viu.
 */
export function useSinalSuporte(aoMudar: (ticketId?: string) => void): void {
  const ref = useRef(aoMudar);
  ref.current = aoMudar;
  useEffect(() => {
    const guardados = new Set<string | undefined>();
    const ouvir = (e: Event) => {
      const ticketId = (e as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (document.visibilityState === 'hidden') {
        guardados.add(ticketId);
        return;
      }
      ref.current(ticketId);
    };
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible' || !guardados.size) return;
      const ids = [...guardados];
      guardados.clear();
      ids.forEach(id => ref.current(id));
    };
    window.addEventListener(SUPPORT_LIVE_EVENT, ouvir);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.removeEventListener(SUPPORT_LIVE_EVENT, ouvir);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, []);
}
