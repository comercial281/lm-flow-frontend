// Tela de Custos do admin (entrega 2). Espelha os serviços de app/services/costs
// do backend; valores em R$ já convertidos lá, a conferência fica em US$.

export interface CostSlice { key: string; label: string; brl: number; usd: number; calls: number; share: number }
export interface TenantSlice { schema: string; name: string; brl: number; usd: number; calls: number; share: number }
export interface StructureCard { provider: 'railway' | 'vercel' | 'evolution'; label: string; usd: number; brl: number; launched: boolean }
export interface Reconciliation { provider: string; label: string; recorded_usd: number; invoice_usd: number | null; diff_pct: number | null }
export interface TenantOption { schema: string; name: string }

export interface CostsSummary {
  month: string;
  tenant: string | null;
  months: string[];
  tenants: TenantOption[];
  rate: { value: number; source: string | null };
  totals: { ai_brl: number; ai_usd: number; structure_brl: number; total_brl: number; calls: number; errors: number; unpriced: number };
  structure: StructureCard[];
  by_feature: CostSlice[];
  by_model: CostSlice[];
  by_tenant: TenantSlice[];
  daily: { day: string; brl: number }[];
  reconciliation: Reconciliation[];
}

export interface CostCall {
  id: string;
  created_at: string;
  tenant_schema: string;
  tenant_name: string;
  feature: string;
  feature_label: string;
  provider: string;
  model: string | null;
  cost_usd: number;
  cost_brl: number;
  latency_ms: number | null;
  status: 'ok' | 'error';
  error_message: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  audio_seconds: number | null;
  characters: number | null;
  units_estimated: boolean;
  priced: boolean;
}

export interface CostCallDetail extends CostCall {
  trigger_type: string | null;
  trigger_id: string | null;
  user_id: string | null;
  usd_brl_rate: number | null;
  payload_status: 'disponivel' | 'apagado' | 'nao_guardado';
  payload_ttl_days: 7 | 30;
  request: unknown;
  response: unknown;
}

export interface CostCallsPage { items: CostCall[]; meta: { total: number; page: number; per_page: number } }

export interface Invoice { provider: string; label: string; amount_usd: number | null; note: string | null; entered_by_email: string | null; updated_at: string | null }
export interface InvoiceInput { provider: string; amount_usd: string; note: string }

export interface CallFilters {
  month: string;
  tenant: string | null;
  feature: string;
  provider: string;
  onlyErrors: boolean;
  page: number;
}
