// Tipos do payload de GET /api/v1/dashboard/metrics.
//
// Espelham Dashboard::MetricsService. Todo bloco pode vir com
// `available: false` quando não há fonte de dado — o front mostra o motivo em
// vez de desenhar zero, que o usuário leria como "não teve movimento".

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export type PeriodPreset =
  | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'
  | 'last_7_days' | 'last_30_days' | 'last_90_days'
  | 'quarter' | 'last_quarter' | 'semester' | 'last_semester'
  | 'year' | 'last_year' | 'all_time' | 'custom';

export interface Unavailable {
  available: false;
  reason: string;
  message?: string;
  error?: string;
}

export type Maybe<T> = (T & { available?: true }) | Unavailable;

export function isAvailable<T>(block: Maybe<T> | undefined): block is T & { available?: true } {
  return !!block && (block as Unavailable).available !== false;
}

/**
 * De quem são os números que este payload traz.
 *
 * `mode` é o que o servidor RESOLVEU, não o que o front pediu: corretor pedindo
 * `all` recebe `mine` de volta. `locked` diz que ele nem pode pedir outro, e é
 * o que faz o seletor não aparecer pra quem não tem escolha.
 *
 * `blocks` diz quais blocos sem dono vieram no payload. Quando é `false`, a
 * chave correspondente NÃO existe em DashboardMetrics — o backend omite em vez
 * de mandar e esconder, senão o número viajaria no JSON.
 */
export type ScopeMode = 'mine' | 'team' | 'all';

export interface ScopeInfo {
  mode: ScopeMode;
  locked: boolean;
  available_modes: ScopeMode[];
  blocks: {
    media_spend: boolean;
    operations: boolean;
  };
}

export interface PeriodInfo {
  preset: PeriodPreset;
  since: string;
  until: string;
  granularity: Granularity;
  days: number;
  previous: { since: string; until: string };
}

export interface KpiValue {
  value: number;
  previous: number;
  delta: number | null;
}

export type KpiKey =
  | 'leads' | 'conversations' | 'proposals' | 'sales'
  | 'vgv' | 'ticket' | 'visits_scheduled' | 'visits_done'
  | 'spend' | 'cost_per_lead' | 'cost_per_visit' | 'cost_per_sale';

export type Kpis = Partial<Record<KpiKey, KpiValue>>;

export interface SeriesBlock {
  granularity: Granularity;
  buckets: string[];
  leads: number[];
  conversations: number[];
  visits: number[];
  leads_previous: number[];
}

export interface SourcesBlock {
  total: number;
  /** contatos criados no periodo — diferente de total, que conta captacoes */
  new_leads?: number;
  items: { source: string; label: string; count: number; percent: number }[];
}

export interface PipelineBlock {
  pipeline: { id: string; name: string };
  pipelines: { id: string; name: string }[];
  /** investimento de mídia no período, base do custo por etapa */
  spend?: number;
  stages: {
    id: string; name: string; color: string; position: number;
    entered: number; current: number;
    /** gasto do período / quantos entraram na etapa; null quando não há base */
    cost_per_entry?: number | null;
  }[];
}

export interface AgentBlock {
  visits_scheduled: number;
  visits_to_confirm: number;
  visits_completed: number;
  visits_cancelled: number;
  leads_in_followup: number;
  /** Ausente sem `dashboard.operations`: uso de IA é métrica de plataforma. */
  ai?: Maybe<{ executions: number; sessions: number; tokens: number }>;
}

export interface AutomationsBlock {
  total_runs: number;
  failures: number;
  top_rules: { id: string; name: string; runs: number }[];
  funnels: Maybe<{ total: number; items: { id: string; name: string; dispatches: number }[] }>;
}

export interface CapiBlock {
  total_sent: number;
  total_failed: number;
  events: { event: string; sent: number; failed: number }[];
  series: number[];
}

/**
 * Tempo até a PRIMEIRA resposta de cada conversa.
 *
 * O topo é o tempo do TIME (mensagens de `User`). A IA vem à parte porque onde
 * a IA Vendedora atende ela responde em segundos, e misturar as duas fazia o
 * gestor ler "meu time responde em 12s" olhando o robô. Ausente quando o tenant
 * não tem IA respondendo — card de IA zerado seria ruído.
 */
export interface ResponseBlock {
  samples: number;
  avg_seconds: number;
  median_seconds: number;
  ai?: { samples: number; avg_seconds: number; median_seconds: number };
}

export interface HeatmapBlock {
  max: number;
  total: number;
  cells: { day: number; hour: number; count: number }[];
}

export interface UpcomingBlock {
  items: {
    id: string;
    scheduled_at: string | null;
    status: string;
    confirmed: boolean;
    contact_name: string;
    realtor_name: string | null;
  }[];
}

export interface HistoryBlock {
  years: { year: number; leads: number }[];
}

export interface AdsBlock {
  account: { id: string; name: string | null };
  last_synced_at: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
  messaging_starts: number;
  /** null quando o denominador é zero — "R$ 0 por visita" com zero visita seria mentira */
  cost_per_lead: number | null;
  cost_per_visit: number | null;
  cost_per_sale: number | null;
  crm: { leads: number; visits: number; sales: number };
  campaigns: { id: string; name: string | null; spend: number; leads: number; clicks: number }[];
  series: number[];
}

/**
 * Leads que entraram sem dono no período.
 *
 * Fica FORA dos KPIs de propósito: se entrasse na conta de cada corretor, dois
 * deles contariam o mesmo lead e a soma das partes passaria o total do gestor.
 * Mas também não pode sumir — no modo Leilão a roleta deixa o lead sem dono de
 * propósito, e o corretor precisa saber que tem lead esperando pra assumir.
 */
export interface QueueBlock {
  leads: number;
  conversations: number;
}

export interface DashboardMetrics {
  period: PeriodInfo;
  scope: ScopeInfo;
  kpis: Maybe<Kpis>;
  series: Maybe<SeriesBlock>;
  sources: Maybe<SourcesBlock>;
  pipeline: Maybe<PipelineBlock>;
  agent: Maybe<AgentBlock>;
  response: Maybe<ResponseBlock>;
  heatmap: Maybe<HeatmapBlock>;
  upcoming: Maybe<UpcomingBlock>;
  history: Maybe<HistoryBlock>;
  queue: Maybe<QueueBlock>;
  /** Ausentes sem `dashboard.operations` — a chave nem vem no payload. */
  automations?: Maybe<AutomationsBlock>;
  capi?: Maybe<CapiBlock>;
  /** Ausente sem `dashboard.media_spend`. */
  ads?: Maybe<AdsBlock>;
}
