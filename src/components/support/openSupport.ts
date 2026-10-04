/**
 * Canal global para abrir o card de suporte. O card mora no SupportWidget
 * (montado uma vez no MainLayout), mas é aberto de fora — o menu do avatar —
 * porque em Conversas a bolinha é escondida (cobria o botão de enviar).
 */
export const SUPPORT_OPEN_EVENT = 'lmflow:open-support';

export interface AlvoSuporte {
  chamadoId?: string;
}

export function openSupport(alvo: AlvoSuporte = {}): void {
  window.dispatchEvent(new CustomEvent<AlvoSuporte>(SUPPORT_OPEN_EVENT, { detail: alvo }));
}
