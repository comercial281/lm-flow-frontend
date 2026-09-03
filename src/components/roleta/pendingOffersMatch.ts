import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

// "Qual oferta da roleta, entre as MINHAS em aberto, é deste lead?"
//
// Fica fora do contexto para ser conferível sem montar provider nem rede. A
// mesma pergunta é feita pelo card do funil (pelo contato), pela conversa
// (pela conversa ou pelo contato dela) e pelo card aberto — e as três precisam
// dar a mesma resposta.
//
// O lead de formulário/anúncio NÃO tem conversa: por isso o casamento por
// contato vem primeiro e é o que vale na maioria dos casos.
export interface OfferLookup {
  contactId?: string | number | null;
  conversationId?: string | number | null;
  conversationDisplayId?: string | number | null;
}

function same(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || a === '' || b === null || b === undefined || b === '') return false;
  return String(a) === String(b);
}

export function offerFor(
  offers: BrokerAssignmentDetail[],
  lookup: OfferLookup,
): BrokerAssignmentDetail | undefined {
  const pendentes = offers.filter(o => o.status === 'pending');
  return (
    pendentes.find(o => same(o.contact_id, lookup.contactId)) ??
    pendentes.find(o => same(o.conversation_id, lookup.conversationId)) ??
    pendentes.find(o => same(o.conversation_display_id, lookup.conversationDisplayId))
  );
}

// Quanto falta, em minutos, medido no relógio do aparelho contra o prazo do
// servidor. O servidor manda `minutes_remaining`, mas ele envelhece entre um
// carregamento e outro (a lista atualiza a cada 60 s).
export function minutesLeft(offer: BrokerAssignmentDetail, now: number = Date.now()): number {
  const deadline = new Date(offer.deadline).getTime();
  if (Number.isNaN(deadline)) return Math.max(0, offer.minutes_remaining ?? 0);
  return Math.max(0, Math.ceil((deadline - now) / 60_000));
}
