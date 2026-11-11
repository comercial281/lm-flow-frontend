import { isRingLeader, playLeadAlert } from './leadAlert';

// A ponte entre o service worker (public/push-sw.js) e a aba. Quando chega push
// de lead com o Modo Plantão ligado, o SW pergunta às abas abertas se alguma
// tocou o Chegou; a aba líder toca e responde. Se ninguém tocou (navegador
// bloqueou, aba não é líder), o SW mostra o aviso do sistema com som.
//
// Oferta da roleta também relê a lista de ofertas NA HORA: é isso que abre o
// pop-up e começa a repetição de 10 em 10 s mesmo com a aba escondida, sem
// esperar a checagem de 15 s (que com a aba escondida nem roda).
export const LEAD_ALERT_MESSAGE = 'lmflow:lead-alert';

interface LeadAlertMessage {
  type: typeof LEAD_ALERT_MESSAGE;
  event: string;
  url?: string;
}

function ehAvisoDeLead(data: unknown): data is LeadAlertMessage {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === LEAD_ALERT_MESSAGE;
}

export function installLeadAlertBridge(onOffer: () => void): () => void {
  const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (!sw) return () => {};

  const aoReceber = (e: MessageEvent) => {
    if (!ehAvisoDeLead(e.data)) return;
    const porta = e.ports?.[0];
    if (e.data.event === 'roleta.oferta_recebida') onOffer();

    if (!isRingLeader()) {
      porta?.postMessage({ played: false });
      return;
    }
    void playLeadAlert().then((played) => porta?.postMessage({ played }));
  };

  sw.addEventListener('message', aoReceber);
  return () => sw.removeEventListener('message', aoReceber);
}
