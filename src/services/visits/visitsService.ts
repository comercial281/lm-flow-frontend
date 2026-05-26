import api from '@/services/core/api';

export interface Visit {
  id: string;
  property_id: string;
  contact_id: string;
  realtor_id?: string | null;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
  scheduled_at: string;
  duration_minutes?: number | null;
  notes?: string;
  feedback_notes?: string;
  rating?: number | null;
  property?: { id: string; title: string; code: string; address_city?: string; address_neighborhood?: string };
  contact?: { id: string; name: string; phone_number?: string };
  realtor?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface VisitFormData {
  property_id: string;
  contact_id: string;
  realtor_id?: string | null;
  scheduled_at: string;
  duration_minutes?: number;
  notes?: string;
}

const BASE = '/visits';

export const visitsService = {
  async list(params: Record<string, string | number | undefined> = {}): Promise<{ data: Visit[]; meta: { total: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: Visit[]; meta: { total: number } };
  },

  async create(data: VisitFormData): Promise<Visit> {
    const res = await api.post(BASE, { visit: data });
    return (res.data as { data: Visit }).data;
  },

  async update(id: string, data: Partial<VisitFormData>): Promise<Visit> {
    const res = await api.put(`${BASE}/${id}`, { visit: data });
    return (res.data as { data: Visit }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async confirm(id: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/confirm`);
    return (res.data as { data: Visit }).data;
  },

  async complete(id: string, rating?: number, feedback?: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/complete`, { rating, feedback_notes: feedback });
    return (res.data as { data: Visit }).data;
  },

  async cancel(id: string, reason?: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/cancel`, { reason });
    return (res.data as { data: Visit }).data;
  },
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled:   'Agendada',
  confirmed:   'Confirmada',
  in_progress: 'Em andamento',
  completed:   'Realizada',
  no_show:     'Não compareceu',
  cancelled:   'Cancelada',
  rescheduled: 'Reagendada',
};

export const VISIT_STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  no_show:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled:   'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
  rescheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};
