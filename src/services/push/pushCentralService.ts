import apiClient from '@/services/core/api';

/**
 * Central de Push — API do super-admin.
 *
 * Roda sempre no host raiz (app.lmflow), onde o setupInterceptor NÃO manda
 * X-Tenant. O backend então fica no schema public, que é onde as regras e o
 * histórico de push moram (tabelas globais). Por isso nenhum método aqui manda
 * tenant no header: quando um disparo é pra um cliente, o slug vai no CORPO e
 * o backend entra no schema dele.
 */

export type PushAudience = 'admin' | 'client';
export type PushTenantScope = 'all' | 'selected';

export interface PushRule {
  id: string;
  name: string;
  trigger: string;
  trigger_label: string;
  tenant_scope: PushTenantScope;
  tenant_slugs: string[];
  audience: PushAudience;
  audience_label: string;
  title: string;
  body: string;
  url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushLog {
  id: string;
  rule_name: string | null;
  trigger: string | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  audience: string | null;
  title: string | null;
  body: string | null;
  status: 'sent' | 'partial' | 'failed' | 'no_subscription';
  status_label: string;
  recipients: number;
  devices: number;
  error: string | null;
  created_at: string;
}

export interface PushOption {
  value: string;
  label: string;
}

export interface PushTenantOption {
  slug: string;
  name: string;
}

export interface PushOptions {
  triggers: PushOption[];
  audiences: PushOption[];
  tenant_scopes: PushOption[];
  tenants: PushTenantOption[];
  variables: string[];
}

export interface PushIndexData {
  rules: PushRule[];
  options: PushOptions;
  /** VAPID configurado no backend. false => nada será entregue. */
  push_ready: boolean;
}

export interface PushRulePayload {
  name: string;
  trigger: string;
  tenant_scope: PushTenantScope;
  tenant_slugs: string[];
  audience: PushAudience;
  title: string;
  body: string;
  url?: string;
  is_active?: boolean;
}

export interface SendNowPayload {
  audience: PushAudience;
  title: string;
  body: string;
  url?: string;
  tenant_slug?: string;
}

// Envelope do backend: { success, data } -> as telas leem res.data.data
const pushCentralService = {
  list: () => apiClient.get<{ success: boolean; data: PushIndexData }>('/super/push_rules'),

  create: (push_rule: PushRulePayload) =>
    apiClient.post<{ success: boolean; data: PushRule }>('/super/push_rules', { push_rule }),

  update: (id: string, push_rule: Partial<PushRulePayload>) =>
    apiClient.put<{ success: boolean; data: PushRule }>(`/super/push_rules/${id}`, { push_rule }),

  remove: (id: string) => apiClient.delete<{ success: boolean }>(`/super/push_rules/${id}`),

  toggle: (id: string) =>
    apiClient.post<{ success: boolean; data: PushRule }>(`/super/push_rules/${id}/toggle`, {}),

  sendNow: (payload: SendNowPayload) =>
    apiClient.post<{ success: boolean; data: PushLog }>('/super/push_rules/send_now', payload),

  logs: (params?: { status?: string; tenant_slug?: string; limit?: number }) =>
    apiClient.get<{ success: boolean; data: PushLog[] }>('/super/push_logs', { params }),
};

export default pushCentralService;
