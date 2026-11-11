import api from '@/services/core/api';

// Sites e landing pages: páginas de fora que mandam lead pro funil.
// Backend: /api/v1/external_lead_pages (lm-flow, PR #595). Envelope { success, data, meta }.

export type ResultadoDoEnvio = 'entered' | 'repeated' | 'rejected' | 'failed';

export interface UltimoEnvio {
  at: string;
  outcome: ResultadoDoEnvio;
  summary: string | null;
  page_host: string | null;
}

export interface PaginaDeSite {
  id: string;
  name: string;
  active: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  roleta_config_id: string | null;
  default_assignee_id: string | null;
  property_id: string | null;
  labels: string[];
  endpoint_url: string;
  last_received_at: string | null;
  leads_30d: number;
  last_delivery: UltimoEnvio | null;
  rejected_last_24h: number;
}

/** Corpo de criar/salvar. No PATCH, trocar quem atende exige mandar os DOIS (o outro null). */
export interface PaginaDeSiteInput {
  name?: string;
  active?: boolean;
  pipeline_id?: string | null;
  stage_id?: string | null;
  roleta_config_id?: string | null;
  default_assignee_id?: string | null;
  property_id?: string | null;
  labels?: string[];
}

export interface EnvioDaPagina {
  at: string;
  name: string | null;
  phone: string | null;
  outcome: ResultadoDoEnvio;
  summary: string;
}

export interface ResultadoDoTeste {
  outcome: ResultadoDoEnvio;
  summary: string;
}

const base = '/external_lead_pages';

export const externalLeadPagesService = {
  async listar(): Promise<PaginaDeSite[]> {
    const res = await api.get(base);
    return (res.data as { data: PaginaDeSite[] }).data ?? [];
  },

  async criar(input: PaginaDeSiteInput): Promise<PaginaDeSite> {
    const res = await api.post(base, input);
    return (res.data as { data: PaginaDeSite }).data;
  },

  async salvar(id: string, input: PaginaDeSiteInput): Promise<PaginaDeSite> {
    const res = await api.patch(`${base}/${id}`, input);
    return (res.data as { data: PaginaDeSite }).data;
  },

  async apagar(id: string): Promise<{ id: string }> {
    const res = await api.delete(`${base}/${id}`);
    return (res.data as { data: { id: string } }).data;
  },

  /** Gera um endereço novo; o antigo para de valer. */
  async trocarEndereco(id: string): Promise<{ endpoint_url: string }> {
    const res = await api.post(`${base}/${id}/rotate_token`);
    return (res.data as { data: { endpoint_url: string } }).data;
  },

  async mandarTeste(id: string, phone: string): Promise<ResultadoDoTeste> {
    const res = await api.post(`${base}/${id}/test_lead`, { phone });
    return (res.data as { data: ResultadoDoTeste }).data;
  },

  /** Os 20 envios mais recentes. */
  async envios(id: string): Promise<EnvioDaPagina[]> {
    const res = await api.get(`${base}/${id}/deliveries`);
    return (res.data as { data: EnvioDaPagina[] }).data ?? [];
  },
};
