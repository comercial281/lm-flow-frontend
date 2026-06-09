import api from '@/services/core/api';

export interface PropertyInterest {
  id: string;
  contact_id: string;
  property_id: string;
  created_by_id?: string | null;
  interest_stage: 'suggested' | 'seen' | 'interested' | 'visit_scheduled' | 'visited' | 'proposal_sent' | 'negotiating' | 'closed_won' | 'closed_lost';
  match_score: number;
  lost_reason?: string | null;
  notes?: string | null;
  scheduled_visit_at?: string | null;
  visited_at?: string | null;
  proposal_sent_at?: string | null;
  property?: {
    id: string;
    code: string;
    title: string;
    display_price: string;
    city?: string;
    neighborhood?: string;
  } | null;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone_number?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyInterestFormData {
  contact_id: string;
  property_id: string;
  interest_stage?: string;
  match_score?: number;
  notes?: string;
  scheduled_visit_at?: string;
}

const BASE = '/property_interests';

export const propertyInterestsService = {
  async list(params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: PropertyInterest[]; meta: { total: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: PropertyInterest[]; meta: { total: number } };
  },

  async listByContact(contactId: string): Promise<{ data: PropertyInterest[] }> {
    const res = await api.get(`/contacts/${contactId}/property_interests`);
    return res.data as { data: PropertyInterest[] };
  },

  async listByProperty(propertyId: string): Promise<{ data: PropertyInterest[] }> {
    const res = await api.get(`/properties/${propertyId}/interests`);
    return res.data as { data: PropertyInterest[] };
  },

  async create(data: PropertyInterestFormData): Promise<PropertyInterest> {
    const res = await api.post(BASE, { property_interest: data });
    return (res.data as { data: PropertyInterest }).data;
  },

  async update(id: string, data: Partial<PropertyInterestFormData>): Promise<PropertyInterest> {
    const res = await api.put(`${BASE}/${id}`, { property_interest: data });
    return (res.data as { data: PropertyInterest }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async advance(id: string): Promise<PropertyInterest> {
    const res = await api.post(`${BASE}/${id}/advance`);
    return (res.data as { data: PropertyInterest }).data;
  },

  async closeLost(id: string, reason: string): Promise<PropertyInterest> {
    const res = await api.post(`${BASE}/${id}/close_lost`, { lost_reason: reason });
    return (res.data as { data: PropertyInterest }).data;
  },

  async closeWon(id: string): Promise<PropertyInterest> {
    const res = await api.post(`${BASE}/${id}/close_won`);
    return (res.data as { data: PropertyInterest }).data;
  },
};

export const INTEREST_STAGE_LABELS: Record<string, string> = {
  suggested:        'Sugerido',
  seen:             'Visualizado',
  interested:       'Interessado',
  visit_scheduled:  'Visita Agendada',
  visited:          'Visitado',
  proposal_sent:    'Proposta Enviada',
  negotiating:      'Em Negociação',
  closed_won:       'Fechado (Ganho)',
  closed_lost:      'Descartado',
};

export const INTEREST_STAGE_COLORS: Record<string, string> = {
  suggested:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  seen:             'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  interested:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  visit_scheduled:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  visited:          'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  proposal_sent:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  negotiating:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  closed_won:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed_lost:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
