import api from '@/services/core/api';

// Regra de disparo de UM estágio do pipeline: qual evento manda pro Meta e pra onde.
export interface CapiStageRule {
  event_name: string;            // 'Lead' | 'Qualificado' | 'Purchase' | ...
  enabled: boolean;
  to_client: boolean;            // dispara no pixel do cliente
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
  test_event_code: string | null;
  default_currency: string;
  stage_map: Record<string, CapiStageRule>;
  known_events: string[];
  intents: string[];
  pipelines: CapiPipeline[];
  updated_at: string;
}

export interface CapiConfigUpdate {
  is_enabled?: boolean;
  pixel_id?: string | null;
  access_token?: string;         // só enviar quando o usuário digitar um novo
  test_event_code?: string | null;
  default_currency?: string;
  stage_map?: Record<string, CapiStageRule>;
}

// Resultado do "Testar conexão": diagnóstico, não erro de API — por isso vem
// com HTTP 200 mesmo quando a Meta recusou. O `ok` de dentro é que decide.
export interface CapiConnectionTest {
  ok: boolean;              // veredito: dá para ENVIAR conversão? é só isso que importa
  can_send: boolean;
  can_read: boolean;        // consegue ler o nome do conjunto (permissão mais ampla, opcional)
  dataset_name: string | null;
  test_event_visible: boolean; // a amostra foi com o código do cliente e aparece na tela dele
  code?: number | null;     // código de erro da Meta (190, 200, 803…)
  message: string;
}

// Credenciais avulsas para testar ANTES de salvar. O que não for enviado, o
// backend pega do que já está gravado.
export interface CapiConnectionTestInput {
  pixel_id?: string;
  access_token?: string;
  test_event_code?: string | null;
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

  async testConnection(data: CapiConnectionTestInput): Promise<CapiConnectionTest> {
    const res = await api.post(`${BASE}/test_connection`, data);
    return (res.data as { data: CapiConnectionTest }).data;
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
