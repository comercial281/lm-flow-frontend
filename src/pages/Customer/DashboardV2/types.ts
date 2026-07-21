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
  | 'vgv' | 'ticket' | 'visits_scheduled' | 'visits_done';

export type Kpis = Record<KpiKey, KpiValue>;

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
  stages: {
    id: string; name: string; color: string; position: number;
    entered: number; current: number;
  }[];
}

export interface AgentBlock {
  visits_scheduled: number;
  visits_to_confirm: number;
  visits_completed: number;
  visits_cancelled: number;
  leads_in_followup: number;
  ai: Maybe<{ executions: number; sessions: number; tokens: number }>;
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

export interface ResponseBlock {
  samples: number;
  avg_seconds: number;
  median_seconds: number;
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

export interface DashboardMetrics {
  period: PeriodInfo;
  kpis: Maybe<Kpis>;
  series: Maybe<SeriesBlock>;
  sources: Maybe<SourcesBlock>;
  pipeline: Maybe<PipelineBlock>;
  agent: Maybe<AgentBlock>;
  automations: Maybe<AutomationsBlock>;
  capi: Maybe<CapiBlock>;
  response: Maybe<ResponseBlock>;
  heatmap: Maybe<HeatmapBlock>;
  upcoming: Maybe<UpcomingBlock>;
  history: Maybe<HistoryBlock>;
  ads: Maybe<AdsBlock>;
}
