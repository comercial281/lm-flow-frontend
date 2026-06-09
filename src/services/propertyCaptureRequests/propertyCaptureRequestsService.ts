import api from '@/services/core/api';

export interface PropertyCaptureRequest {
  id: string;
  status: 'pending_review' | 'assigned' | 'visiting' | 'approved' | 'rejected' | 'converted';
  source: string;
  transaction_type: string;
  property_type: string;
  owner: {
    contact_id?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  address: {
    cep?: string | null;
    full?: string | null;
    city?: string | null;
    state?: string | null;
  };
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  useful_area_m2?: number | null;
  expected_price?: number | null;
  description?: string | null;
  additional_info?: string | null;
  captor_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by_id?: string | null;
  rejection_reason?: string | null;
  property_id?: string | null;
  photo_urls?: string[];
  created_at: string;
  updated_at: string;
}

const BASE = '/property_capture_requests';

export const propertyCaptureRequestsService = {
  async list(params: Record<string, string | boolean | undefined> = {}): Promise<{ data: PropertyCaptureRequest[]; meta: { total: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: PropertyCaptureRequest[]; meta: { total: number } };
  },

  async get(id: string): Promise<PropertyCaptureRequest> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: PropertyCaptureRequest }).data;
  },

  async update(id: string, data: Record<string, unknown>): Promise<PropertyCaptureRequest> {
    const res = await api.put(`${BASE}/${id}`, { capture_request: data });
    return (res.data as { data: PropertyCaptureRequest }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async approve(id: string): Promise<{ property_id?: string }> {
    const res = await api.post(`${BASE}/${id}/approve`);
    return res.data as { property_id?: string };
  },

  async reject(id: string, reason: string): Promise<PropertyCaptureRequest> {
    const res = await api.post(`${BASE}/${id}/reject`, { reason });
    return (res.data as { data: PropertyCaptureRequest }).data;
  },

  async assign(id: string, userId: string): Promise<PropertyCaptureRequest> {
    const res = await api.post(`${BASE}/${id}/assign`, { user_id: userId });
    return (res.data as { data: PropertyCaptureRequest }).data;
  },
};

export const CAPTURE_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Aguardando análise',
  assigned:       'Captador designado',
  visiting:       'Em visita',
  approved:       'Aprovado',
  rejected:       'Rejeitado',
  converted:      'Convertido em imóvel',
};

export const CAPTURE_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  assigned:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  visiting:       'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  approved:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  converted:      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};
