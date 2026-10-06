import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

// O que o pop-up de aceite guarda e decide, fora do JSX.
//
// "Vista" = o corretor clicou em *Ver depois* (ou fechou o pop-up). A oferta
// vista não reabre em pop-up: ela continua na faixa amarela do topo, e só
// oferta NOVA abre. A lista mora na memória da sessão e no sessionStorage,
// para que recarregar a tela na mesma aba não reabra o que ele já adiou.
// O armazenamento pode faltar (aba anônima, bloqueio do navegador): toda
// leitura e escrita passa por try/catch e, sem ele, vale só a memória.

export const CHAVE_OFERTAS_VISTAS = 'lmflow:roleta:ofertas-vistas';

export function lerVistas(): Set<string> {
  try {
    const bruto = sessionStorage.getItem(CHAVE_OFERTAS_VISTAS);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function gravarVistas(vistas: Set<string>): void {
  try {
    sessionStorage.setItem(CHAVE_OFERTAS_VISTAS, JSON.stringify([...vistas]));
  } catch {
    /* sem armazenamento: fica só na memória */
  }
}

/** As ofertas que ainda podem abrir em pop-up, da mais antiga para a mais nova. */
export function ofertasNaoVistas(offers: BrokerAssignmentDetail[], vistas: Set<string>): BrokerAssignmentDetail[] {
  return offers
    .filter(o => !vistas.has(o.id))
    .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());
}

/**
 * Para onde o Aceitar leva: a conversa do lead (a mesma da tela de aceite) e,
 * no lead sem conversa (formulário, anúncio), o card do lead.
 */
export function destinoDoLead(d: BrokerAssignmentDetail): string {
  const conversa = d.conversation_display_id ?? d.conversation_id;
  if (conversa) return `/conversations/${conversa}`;
  if (d.contact_id) return `/contacts/${d.contact_id}`;
  return '/conversations';
}
