// Clientes do admin (lista, página do cliente e pacotes) — formato do servidor.
export interface AiUsage {
  period: string; ai_leads: number; replied: number; runs: number; cost_usd: number; cost_brl: number; usd_brl_rate: number;
  usd_brl_source: 'api' | 'config' | 'fallback' | 'accounting' | 'default'; usd_brl_at: string | null; ai_leads_included: number | null; overage_leads: number;
  overage_price_brl: number; overage_amount_brl: number; usage_pct: number | null;
  franchise_status: 'sem_franquia' | 'ok' | 'atencao' | 'estourado';
}

export interface PacoteResumo { id: string; name: string; price_brl?: number | null }

export interface DiffDoPacote {
  features: { key: string; label: string; tenant: boolean; package: boolean }[];
  limits: { key: 'max_whatsapp_channels' | 'ai_leads_included' | 'ai_lead_overage_price_brl'; tenant: number | null; package: number | null }[];
}

export interface ClientePooled {
  id: string; name: string; slug: string; schema_name: string; status: string; situation?: string; archived?: boolean;
  members: number | null; whatsapp_channels_used?: number | null; max_whatsapp_channels?: number;
  ai_leads_included?: number | null; ai_lead_overage_price_brl?: number; broker_isolation?: boolean; campaign_only_inbox?: boolean;
  settings?: Record<string, any>; created_at?: string; login_url: string; ai_usage?: AiUsage;
  package?: PacoteResumo | null; package_diff?: DiffDoPacote | null; package_diff_count?: number;
}

export interface Pessoa {
  id: string; email: string; name?: string; whatsapp_number?: string | null; role?: string; last_seen_at?: string | null;
}

export interface NovaPessoa { email: string; name?: string; whatsapp_number?: string; send_whatsapp?: boolean; instance?: string }
