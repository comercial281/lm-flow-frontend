import api from '@/services/core/api';
import type { PerformanceReport } from '@/types/aiResults';
import type { RehearsalTurn, TestHistoryItem } from '@/services/salesAgents/salesAgentsService';

// Épico B — super-admin gerencia os agentes de IA de TODOS os tenants sem SSO.
// Backend: /api/v1/super/sales_agents (?tenant=<slug>; raiz Leal Mídia = slug vazio).

export interface ActiveHours {
  mode?: string;
  tz?: string;
  windows?: Array<{ start?: string; end?: string; days?: number[] }>;
}

export interface SuperAgent {
  id: string;
  tenant_slug: string | null;
  tenant_name: string;
  name: string;
  enabled: boolean;
  mode: string;
  trigger_keyword?: string | null;
  inbox_id?: string | null;
  inbox_name?: string | null;
  followup_enabled?: boolean;
  updated_at: string;
  // full:
  persona_role?: string | null;
  persona_goal?: string | null;
  instructions?: string | null;
  active_hours?: ActiveHours | null;
  max_context_tokens?: number;
  temperature?: number;
  sales_method?: string | null;
  booking_enabled?: boolean;
  // Economia de tokens
  model?: string | null;
  test_model?: string | null;
  max_output_tokens?: number | null;
}

// Catálogo vindo do backend (fonte única: preço real + mínimo de cache).
export interface ModelOption {
  id: string;
  label: string;
  input: number;   // USD por 1M tokens de entrada
  output: number;  // USD por 1M tokens de saída
  min_cache_tokens: number;
  sampling: boolean;
  use_for: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export type SuperAgentPatch = Partial<
  Pick<SuperAgent, 'name' | 'enabled' | 'mode' | 'trigger_keyword' | 'inbox_id' | 'followup_enabled' | 'booking_enabled' | 'active_hours'
  | 'model' | 'test_model' | 'max_output_tokens'>
>;

// Comparação antigo × novo (entrega 3 da IA Vendedora). Só super-admin.
export interface ComparisonCandidate {
  id: string;
  contact_name: string | null;
  last_reply_at: string | null;
  points: number;
  in_handoff: boolean;
  has_visit: boolean;
}

export type ComparisonItem = 'obrigatorias' | 'repasse' | 'persona' | 'configuracao' | 'puxou_conversa' | 'seguranca';
export type ComparisonScores = Record<ComparisonItem, number | null>;

export interface ComparisonSide {
  version: number;
  turn: RehearsalTurn;
  scores: ComparisonScores;
  comment: string | null;
}

export interface ComparisonResult {
  conversation_id?: string;
  point_index?: number;
  scenario_id?: string;
  history_tail: string;
  real_reply: string | null;
  baseline: ComparisonSide;
  candidate: ComparisonSide;
  judge_model: string | null;
  disagreement: boolean;
}

export type ComparisonEvaluateBody = {
  run_id: string;
  baseline_version: number;
  candidate_version: number;
} & (
  | { conversation_id: string; point_index: number }
  | { scenario: { id: string; message: string; history: TestHistoryItem[] } }
);

function erroDaComparacao(err: unknown): Error {
  const e = err as { response?: { data?: { error?: string } } };
  return new Error(e.response?.data?.error || 'A comparação falhou.');
}

export const superAgentsService = {
  async listAll(): Promise<SuperAgent[]> {
    const res = await api.get('/super/sales_agents');
    return (res.data as Envelope<SuperAgent[]>).data;
  },

  async get(id: string, tenantSlug: string | null): Promise<SuperAgent> {
    const res = await api.get(`/super/sales_agents/${id}`, { params: { tenant: tenantSlug ?? '' } });
    return (res.data as Envelope<SuperAgent>).data;
  },

  async update(id: string, tenantSlug: string | null, patch: SuperAgentPatch): Promise<SuperAgent> {
    const res = await api.put(`/super/sales_agents/${id}`, patch, { params: { tenant: tenantSlug ?? '' } });
    return (res.data as Envelope<SuperAgent>).data;
  },

  async inboxes(tenantSlug: string | null): Promise<Array<{ id: string; name: string }>> {
    const res = await api.get('/super/sales_agents/inboxes', { params: { tenant: tenantSlug ?? '' } });
    return (res.data as Envelope<Array<{ id: string; name: string }>>).data;
  },

  async models(): Promise<ModelOption[]> {
    const res = await api.get('/super/sales_agents/models');
    return (res.data as Envelope<ModelOption[]>).data;
  },

  // O RESULTADO da IA (o avesso do gasto). Traz todos os
  // clientes de uma vez, cada um com a própria série diária, porque trocar de
  // cliente é o gesto mais repetido quando a tela está sendo mostrada pra alguém.
  async performance(days = 30): Promise<PerformanceReport> {
    const res = await api.get('/super/sales_agents/performance', { params: { days } });
    return (res.data as Envelope<PerformanceReport>).data;
  },

  async comparisonCandidates(
    id: string, tenantSlug: string | null, versoes: { baseline_version: number; candidate_version: number },
  ): Promise<ComparisonCandidate[]> {
    try {
      const res = await api.post(`/super/sales_agents/${id}/prompt_comparison`, { mode: 'candidates', ...versoes },
        { params: { tenant: tenantSlug ?? '' } });
      return (res.data as Envelope<{ conversations: ComparisonCandidate[] }>).data.conversations;
    } catch (err) {
      throw erroDaComparacao(err);
    }
  },

  // UM par por chamada (10–40 s cada): a tela mostra o progresso e pode parar.
  async comparisonEvaluate(id: string, tenantSlug: string | null, body: ComparisonEvaluateBody): Promise<ComparisonResult> {
    try {
      const res = await api.post(`/super/sales_agents/${id}/prompt_comparison`, { mode: 'evaluate', ...body },
        { params: { tenant: tenantSlug ?? '' }, timeout: 120_000 });
      return (res.data as Envelope<ComparisonResult>).data;
    } catch (err) {
      throw erroDaComparacao(err);
    }
  },
};

// Resultados da IA — os tipos vivem em @/types/aiResults porque a aba do cliente
// lê exatamente o mesmo formato. Reexportados aqui para não quebrar quem já
// importava daqui.
export type {
  PerformancePoint,
  PerformanceCounts,
  PerformanceTenant,
  PerformanceTotals,
  PerformanceReport,
} from '@/types/aiResults';
export const MODE_LABELS: Record<string, string> = {
  seller: 'Vendedor(a)',
  sdr: 'SDR (qualifica e agenda)',
  assistant: 'Assistente (sugere ao corretor)',
};
