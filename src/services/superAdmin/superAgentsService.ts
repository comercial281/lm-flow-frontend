import api from '@/services/core/api';

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
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export type SuperAgentPatch = Partial<
  Pick<SuperAgent, 'name' | 'enabled' | 'mode' | 'trigger_keyword' | 'inbox_id' | 'followup_enabled' | 'booking_enabled' | 'active_hours'>
>;

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
};

export const MODE_LABELS: Record<string, string> = {
  seller: 'Vendedor(a)',
  sdr: 'SDR (qualifica e agenda)',
  assistant: 'Assistente (sugere ao corretor)',
};
