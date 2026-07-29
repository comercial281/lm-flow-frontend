import apiClient from '@/services/core/api';

/** Origem/campanha do lead. `source` são os valores canônicos do backend
 *  (LeadOrigin::Recorder); `label` já vem traduzido pra pt-BR. */
export interface LeadFeedOrigin {
  source: string;
  label: string;
  campaign: string | null;
  form_name: string | null;
  ad_id: string | null;
}

export interface LeadFeedPipeline {
  name: string | null;
  stage: string | null;
}

export interface LeadFeedItem {
  id: string;
  client_slug: string;
  client_name: string;
  name: string;
  phone: string | null;
  created_at: string;
  origin: LeadFeedOrigin;
  pipeline: LeadFeedPipeline | null;
}

/** Resumo por cliente: alimenta os KPIs e o alerta de "parou de chegar lead". */
export interface LeadsFeedClient {
  slug: string;
  name: string;
  count_today?: number;
  count_1h?: number;
  last_lead_at?: string | null;
  minutes_since_last_lead?: number | null;
  never_had_lead?: boolean;
  silent?: boolean;
  /** Schema do cliente não pôde ser lido nesta chamada. */
  unavailable?: boolean;
}

export interface LeadsFeedData {
  leads: LeadFeedItem[];
  clients: LeadsFeedClient[];
  /** Relógio do servidor — vira o `since` do próximo poll (evita clock skew). */
  server_time: string;
  overview: {
    total_today: number;
    total_1h: number;
    clients_total: number;
    clients_silent: number;
  };
}

export interface LeadsFeedParams {
  /** Cursor de tail. Ausente = carga inicial pela janela de `hours`. */
  since?: string;
  hours?: number;
  limit?: number;
  silence_minutes?: number;
}

const superLeadsFeedService = {
  getLeadsFeed: (params: LeadsFeedParams = {}) =>
    apiClient.get<{ success: boolean; data: LeadsFeedData }>('/super/leads_feed', { params }),
};

export default superLeadsFeedService;
