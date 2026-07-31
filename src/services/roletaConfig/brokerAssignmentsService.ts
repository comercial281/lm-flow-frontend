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
};
