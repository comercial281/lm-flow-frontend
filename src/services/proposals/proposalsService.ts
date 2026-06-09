import api from '@/services/core/api';

export interface Proposal {
  id: string;
  proposal_type: 'purchase' | 'rent';
  status: 'draft' | 'sent' | 'counter_offered' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  offered_value: number;
  counter_value?: number | null;
  down_payment?: number | null;
  installments?: number | null;
  payment_method?: string | null;
  display_offered_value: string;
  conditions?: string | null;
  rejection_reason?: string | null;
  sent_at?: string | null;
  responded_at?: string | null;
  expires_at?: string | null;
  document_url?: string | null;
  signature_request_id?: string | null;
  property_id: string;
  contact_id: string;
  property_interest_id?: string | null;
  realtor_id?: string | null;
  property?: { id: string; code: string; title: string } | null;
  contact?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalFormData {
  property_id: string;
  contact_id: string;
  proposal_type: 'purchase' | 'rent';
  offered_value: number;
  down_payment?: number;
  installments?: number;
  payment_method?: string;
  conditions?: string;
  property_interest_id?: string;
  realtor_id?: string;
}

const BASE = '/proposals';

export const proposalsService = {
  async list(params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: Proposal[]; meta: { total: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: Proposal[]; meta: { total: number } };
  },

  async get(id: string): Promise<Proposal> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: Proposal }).data;
  },

  async create(data: ProposalFormData): Promise<Proposal> {
    const res = await api.post(BASE, { proposal: data });
    return (res.data as { data: Proposal }).data;
  },

  async update(id: string, data: Partial<ProposalFormData>): Promise<Proposal> {
    const res = await api.put(`${BASE}/${id}`, { proposal: data });
    return (res.data as { data: Proposal }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async send(id: string, expiresInDays = 7): Promise<Proposal> {
    const res = await api.post(`${BASE}/${id}/send_proposal`, { expires_in_days: expiresInDays });
    return (res.data as { data: Proposal }).data;
  },

  async counter(id: string, counterValue: number): Promise<Proposal> {
    const res = await api.post(`${BASE}/${id}/counter`, { counter_value: counterValue });
    return (res.data as { data: Proposal }).data;
  },

  async accept(id: string): Promise<Proposal> {
    const res = await api.post(`${BASE}/${id}/accept`);
    return (res.data as { data: Proposal }).data;
  },

  async reject(id: string, reason: string): Promise<Proposal> {
    const res = await api.post(`${BASE}/${id}/reject`, { reason });
    return (res.data as { data: Proposal }).data;
  },

  async withdraw(id: string): Promise<Proposal> {
    const res = await api.post(`${BASE}/${id}/withdraw`);
    return (res.data as { data: Proposal }).data;
  },
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft:          'Rascunho',
  sent:           'Enviada',
  counter_offered:'Contra-proposta',
  accepted:       'Aceita',
  rejected:       'Rejeitada',
  withdrawn:      'Desistência',
  expired:        'Expirada',
};

export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft:          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent:           'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  counter_offered:'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  accepted:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  withdrawn:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  expired:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  purchase: 'Compra',
  rent:     'Locação',
};
