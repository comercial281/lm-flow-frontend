import api from '@/services/core/api';

/**
 * O que a IA já descobriu deste lead, montado pelo servidor a partir do que ela
 * gravou a cada mensagem — o mesmo conteúdo do bloco *O que a IA entendeu* da
 * lateral da conversa.
 *
 * Vem NULO quando o lead não passou pela IA (anúncio, formulário, portal,
 * orgânico), que é a maioria dos leads da roleta.
 */
export interface OfferAiBriefing {
  temperature: string | null;
  temperature_label: string | null;
  stage_label: string | null;
  intent_label: string | null;
  sentiment_label: string | null;
  fields: Array<{ key: string; label: string; value: string }>;
  checklist: Array<{ question: string; answer: string; required: boolean }>;
  summary: string | null;
  handoff_reason: string | null;
}

export interface BrokerAssignmentDetail {
  id: string;
  status: 'pending' | 'accepted' | 'passed' | 'expired' | 'cancelled';
  lead_name: string;
  lead_phone: string | null;
  assigned_at: string;
  // Roleta SEM prazo de aceite: `deadline` e `minutes_remaining` vêm nulos e
  // `no_deadline` true. Nunca traduzir nulo como "prazo esgotado" — ver
  // components/roleta/offerDeadline.ts.
  deadline: string | null;
  minutes_remaining: number | null;
  timeout_minutes: number;
  no_deadline?: boolean;
  round: number;
  corretor: string | null;
  conversation_id: string | null;
  conversation_display_id: number | null;
  // De QUAL lead é a oferta. É com isto que o card e a conversa desenham
  // "Aguardando seu aceite": o lead de formulário não tem conversa, então só
  // o conversation_id não casava com o card.
  contact_id?: string | null;
  pipeline_item_id?: string | null;
  roleta_instance_id?: string | null;
  instance_name?: string | null;
  // Opcional de propósito: contra o servidor antigo a tela simplesmente não
  // desenha a ficha, e nada mais muda.
  ia_briefing?: OfferAiBriefing | null;
}

const BASE = '/broker_assignments';

export const brokerAssignmentsService = {
  // As ofertas que esperam ESTE corretor. Sem isto, a única porta de entrada era o
  // link que vai no WhatsApp — perdeu o link, perdeu o lead.
  async listMine(): Promise<BrokerAssignmentDetail[]> {
    const res = await api.get(BASE);
    return (res.data as { data: BrokerAssignmentDetail[] }).data ?? [];
  },
  async get(id: string): Promise<BrokerAssignmentDetail> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: BrokerAssignmentDetail }).data;
  },
  async accept(id: string): Promise<BrokerAssignmentDetail> {
    const res = await api.post(`${BASE}/${id}/accept`);
    return (res.data as { data: BrokerAssignmentDetail }).data;
  },
  async refuse(id: string): Promise<BrokerAssignmentDetail> {
    const res = await api.post(`${BASE}/${id}/refuse`);
    return (res.data as { data: BrokerAssignmentDetail }).data;
  },

  // As ofertas EM ABERTO de um lead. É o que decide se o botão "Tirar da roleta"
  // aparece no card: sem oferta correndo não há o que tirar.
  async listForLead(contactId: string): Promise<BrokerAssignmentDetail[]> {
    const res = await api.get(`${BASE}/for_lead`, { params: { contact_id: contactId } });
    return (res.data as { data: BrokerAssignmentDetail[] }).data ?? [];
  },

  // Encerra as ofertas do lead e para o prazo. `assignTo` vazio deixa o lead sem
  // responsável, visível para o time — o mesmo estado de quando a roleta se
  // esgota. Com um corretor, o lead fica com ele sem precisar de aceite.
  async cancelForLead(contactId: string, assignTo?: string | null): Promise<{ cancelled: number; owner_id: string | null }> {
    const res = await api.post(`${BASE}/cancel_for_lead`, {
      contact_id: contactId,
      assign_to: assignTo || undefined,
    });
    return (res.data as { data: { cancelled: number; owner_id: string | null } }).data;
  },
};
