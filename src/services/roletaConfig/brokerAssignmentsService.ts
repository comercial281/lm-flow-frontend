import api from '@/services/core/api';

export interface BrokerAssignmentDetail {
  id: string;
  status: 'pending' | 'accepted' | 'passed' | 'expired' | 'cancelled';
  lead_name: string;
  lead_phone: string | null;
  assigned_at: string;
  deadline: string;
  minutes_remaining: number;
  timeout_minutes: number;
  round: number;
  corretor: string | null;
  conversation_id: string | null;
  conversation_display_id: number | null;
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
