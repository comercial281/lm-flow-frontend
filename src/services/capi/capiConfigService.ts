import api from '@/services/core/api';

// Regra de disparo de UM estágio do pipeline: qual evento manda pro Meta e pra onde.
export interface CapiStageRule {
  event_name: string;            // 'Lead' | 'Qualificado' | 'Purchase' | ...
  enabled: boolean;
  to_client: boolean;            // dispara no pixel do cliente
  to_lm: boolean;                // dispara no dataset geral da Leal Mídia
  value_field?: string | null;   // p/ Purchase: 'card_value' ou atributo custom
  intent?: 'lookalike' | 'exclusion' | 'none';
}

export interface CapiPipelineStage {
  id: string;
  name: string | null;
  position: number | null;
}

export interface CapiPipeline {
  id: string;
  name: string | null;
  stages: CapiPipelineStage[];
}

export interface CapiConfig {
  id: string;
  is_enabled: boolean;
  pixel_id: string | null;
  access_token_set: boolean;     // backend nunca devolve o token cru
  contribute_to_lm: boolean;
  test_event_code: string | null;
  default_currency: string;
  stage_map: Record<string, CapiStageRule>;
  lm_pixel_configured: boolean;  // dataset geral da Leal Mídia está configurado?
  known_events: string[];
  intents: string[];
  pipelines: CapiPipeline[];
  updated_at: string;
}

export interface CapiConfigUpdate {
  is_enabled?: boolean;
  pixel_id?: string | null;
  access_token?: string;         // só enviar quando o usuário digitar um novo
  contribute_to_lm?: boolean;
  test_event_code?: string | null;
  default_currency?: string;
  stage_map?: Record<string, CapiStageRule>;
}

const BASE = '/capi_config';

export const capiConfigService = {
  async get(): Promise<CapiConfig> {
    const res = await api.get(BASE);
    return (res.data as { data: CapiConfig }).data;
  },

  async update(data: CapiConfigUpdate): Promise<CapiConfig> {
    const res = await api.patch(BASE, data);
    return (res.data as { data: CapiConfig }).data;
  },
};

// Rótulos amigáveis dos eventos no dropdown.
export const CAPI_EVENT_LABELS: Record<string, string> = {
  Lead: 'Lead (entrou)',
  Qualificado: 'Qualificado',
  Desqualificado: 'Desqualificado',
  Schedule: 'Agendamento',
  VisitaAgendada: 'Visita agendada',
  VisitaRealizada: 'Visita realizada',
  Contact: 'Contato',
  Purchase: 'Venda (com valor)',
  UltraQualificado: 'Ultra qualificado',
};

export const CAPI_INTENT_LABELS: Record<string, string> = {
  lookalike: 'Semelhante (buscar parecidos)',
  exclusion: 'Exclusão (não gastar com parecidos)',
  none: 'Só registrar',
};
