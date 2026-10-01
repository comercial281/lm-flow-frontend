// Tipos do payload de GET /api/v1/dashboard/metrics?blocks=… (a Dashboard nova)
// e de GET /api/v1/dashboard/list (a lista rápida).
//
// Espelham Dashboard::MetricsService, PropertiesSummary, PendingNow,
// TeamService e QuickList. Os blocos antigos reaproveitam os tipos da
// DashboardV2, que é o mesmo serviço.
import type {
  AgentBlock, AiBlock, HeatmapBlock, HistoryBlock, Kpis, Maybe, PeriodInfo, PeriodPreset, PipelineBlock,
  QueueBlock, ResponseBlock, ScopeInfo, ScopeMode, SeriesBlock, SourcesBlock, UpcomingBlock,
} from '../DashboardV2/types';

/**
 * Os nomes que a API entende em `blocks=` (Dashboard::MetricsService::BLOCKS).
 * Nome fora desta lista o servidor ignora. Anúncios, automações e CAPI não
 * existem com `blocks=`: só no payload antigo.
 */
export type BlocoApi =
  | 'kpis' | 'series' | 'sources' | 'pipeline' | 'agent' | 'ai' | 'response' | 'heatmap'
  | 'upcoming' | 'history' | 'queue'
  | 'properties' | 'pending' | 'team' | 'results'
  | 'leads_by_weekday' | 'leads_by_hour' | 'leads_6_months';

export interface PropertiesSummary {
  active: number; new: number; exclusive: number; on_sign: number;
  without_photos: number; off_site: number; stale: number; stale_after_days: number;
}

export type PendenciaChave =
  | 'sem_responsavel' | 'esperando_resposta' | 'sem_contato' | 'visitas_a_confirmar' | 'visitas_sem_feedback';

export interface PendingBlock {
  /** `sem_responsavel` não vem para quem está no recorte `mine`. `capped` só em `esperando_resposta`. */
  rows: { key: PendenciaChave; total: number; older: number; capped?: boolean }[];
}

export interface TeamPerson {
  user_id: string; name: string; median_seconds: number | null; samples: number;
  waited_over_hour: number; visits_done: number; visits_with_feedback: number;
}

export interface TeamBlock {
  total: {
    median_seconds: number | null; previous_median_seconds: number | null; waited_over_hour: number;
    /** 1ª resposta da IA (AgentBot ou IA Vendedora). Mora aqui, não em `response.ai`. */
    ai_median_seconds: number | null; ai_samples: number;
    visits_done: number; visits_with_feedback: number; feedback_percent: number | null;
  };
  people: TeamPerson[];
}

export interface ResultsBlock {
  sales: number; vgv: number; ticket: number; leads: number;
  lead_to_sale_percent: number | null; visits_done: number; good_visits: number;
}

/** `day`: 0 = domingo … 6 = sábado (DOW do Postgres, no fuso da conta). */
export interface WeekdayBlock { days: { day: number; leads: number }[] }
export interface HourBlock { hours: { hour: number; leads: number }[] }
/** `month` no formato 'YYYY-MM'. Janela fixa: os 5 meses anteriores e o atual. */
export interface SixMonthsBlock { months: { month: string; leads: number }[] }

export interface PeriodInfoNova extends PeriodInfo {
  /**
   * Janela das visitas: o mês/semana/ano inteiro, incluindo as que ainda vão
   * acontecer (o `until` do período para em hoje). Servidor antigo não manda.
   */
  calendar?: { since: string; until: string };
}

export interface ScopeInfoNova extends ScopeInfo {
  /** Corretor escolhido no filtro, quando o servidor aceitou. Sempre vem; null sem filtro. */
  owner_id: string | null;
}

/**
 * Só vêm as chaves pedidas em `blocks=`. `team` e `results` também somem no
 * recorte `mine`, mesmo pedidas.
 */
export interface DashboardNovaPayload {
  period: PeriodInfoNova;
  scope: ScopeInfoNova;
  kpis?: Maybe<Kpis>;
  series?: Maybe<SeriesBlock>;
  sources?: Maybe<SourcesBlock>;
  pipeline?: Maybe<PipelineBlock>;
  agent?: Maybe<AgentBlock>;
  ai?: Maybe<AiBlock>;
  response?: Maybe<ResponseBlock>;
  heatmap?: Maybe<HeatmapBlock>;
  upcoming?: Maybe<UpcomingBlock>;
  history?: Maybe<HistoryBlock>;
  queue?: Maybe<QueueBlock>;
  properties?: Maybe<PropertiesSummary>;
  pending?: Maybe<PendingBlock>;
  team?: Maybe<TeamBlock>;
  results?: Maybe<ResultsBlock>;
  leads_by_weekday?: Maybe<WeekdayBlock>;
  leads_by_hour?: Maybe<HourBlock>;
  leads_6_months?: Maybe<SixMonthsBlock>;
}

export type ListaKind = PendenciaChave | 'leads_periodo' | 'conversas_periodo';

export type AbrirItem =
  | { type: 'card'; pipeline_id: string; item_id: string }
  | { type: 'conversation'; id: string }
  | { type: 'visit'; id: string };

export interface ListaItem {
  id: string; title: string; subtitle: string | null; owner_name: string | null;
  since: string | null;
  /** Sempre vem: o servidor não lista item sem destino. */
  open: AbrirItem;
}

export interface ListaRapidaPayload { kind: ListaKind; total: number; items: ListaItem[] }

export interface FiltrosDashboard {
  preset: PeriodPreset;
  scope?: ScopeMode;
  ownerId?: string;
  inboxId?: string;
  labelId?: string;
  aiOnly?: boolean;
  salesAgentId?: string;
  pipelineId?: string;
}
