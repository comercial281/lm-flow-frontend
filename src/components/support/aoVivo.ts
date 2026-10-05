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

/** Chama `aoMudar(ticketId)` a cada sinal. A função mais recente vale sempre. */
export function useSinalSuporte(aoMudar: (ticketId?: string) => void): void {
  const ref = useRef(aoMudar);
  ref.current = aoMudar;
  useEffect(() => {
    const ouvir = (e: Event) => ref.current((e as CustomEvent<{ ticketId?: string }>).detail?.ticketId);
    window.addEventListener(SUPPORT_LIVE_EVENT, ouvir);
    return () => window.removeEventListener(SUPPORT_LIVE_EVENT, ouvir);
  }, []);
}
