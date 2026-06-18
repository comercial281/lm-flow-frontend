import api from '@/services/core/api';

// Config de roteamento de um formulário Lead Ads (Meta) -> destino no CRM.
export interface LeadAdsFormConfig {
  id: string;
  form_id: string;
  form_name: string;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  label_ids: string[];
  is_active: boolean;
  created_at: string;
}

// Formulário vindo do Facebook (GET meta_forms). `id` = form_id.
export interface MetaForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
}

// Payload de create/update (sempre dentro de lead_ads_form_config).
export interface LeadAdsFormConfigFormData {
  form_id: string;
  form_name: string;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  is_active: boolean;
  label_ids: string[];
}

// Resposta de meta_forms — pode vir { data, error } se a Meta não estiver conectada.
export interface MetaFormsResult {
  data: MetaForm[];
  error?: string;
}

const BASE = '/lead_ads_form_configs';

export const leadAdsFormsService = {
  async getAll(): Promise<LeadAdsFormConfig[]> {
    const res = await api.get(BASE);
    return (res.data as { data: LeadAdsFormConfig[] }).data ?? [];
  },

  async create(data: LeadAdsFormConfigFormData): Promise<LeadAdsFormConfig> {
    const res = await api.post(BASE, { lead_ads_form_config: data });
    return (res.data as { data: LeadAdsFormConfig }).data;
  },

  async update(id: string, data: LeadAdsFormConfigFormData): Promise<LeadAdsFormConfig> {
    const res = await api.patch(`${BASE}/${id}`, { lead_ads_form_config: data });
    return (res.data as { data: LeadAdsFormConfig }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async syncMetaForms(): Promise<MetaFormsResult> {
    const res = await api.get(`${BASE}/meta_forms`);
    const body = res.data as { data?: MetaForm[]; error?: string };
    return { data: body.data ?? [], error: body.error };
  },
};
