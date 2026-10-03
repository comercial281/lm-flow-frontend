import api from '@/services/core/api';

export interface PropertyCaptureRequest {
  id: string;
  status: 'received' | 'in_review' | 'approved' | 'rejected' | 'withdrawn';
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
  /**
   * Filtros além de `status`: `created_after` (ISO 8601, só captações criadas
   * depois) e `pending` (true = só as que ainda aguardam decisão).
   */
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

  async approve(id: string): Promise<{ property_id: string }> {
    const res = await api.post(`${BASE}/${id}/approve`);
    // Envelope do servidor: { success, data: { ...pedido, property_id }, meta }.
    return (res.data as { data: { property_id: string } }).data;
  },

  async reject(id: string, reason: string): Promise<PropertyCaptureRequest> {
    const res = await api.post(`${BASE}/${id}/reject`, { reason });
    return (res.data as { data: PropertyCaptureRequest }).data;
  },
};
