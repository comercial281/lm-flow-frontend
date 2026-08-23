import api from '@/services/core/api';

/**
 * Painel de Notificações (Área do Admin) — o liga/desliga de cada aviso do
 * produto, canal a canal, CLIENTE A CLIENTE.
 *
 * Roda sempre no host raiz, SEM header X-Tenant: o super-admin está logado no
 * schema public e o cliente-alvo vai no path. Mesma regra do pushCentralService,
 * e pelo mesmo motivo — a política mora em saas_tenants, que só existe no public.
 *
 * Envelope { success, data }, então as telas leem res.data.data.
 */

export type NotificationChannel = 'bell' | 'push' | 'email' | 'whatsapp';

export type ParamType = 'boolean' | 'string' | 'integer' | 'origin_groups' | 'stage_ids';

export interface CatalogParam {
  key: string;
  type: ParamType;
  default: unknown;
  label: string;
  hint?: string;
}

export interface CatalogEvent {
  key: string;
  label: string;
  description: string;
  group: string;
  channels: NotificationChannel[];
  defaults: NotificationChannel[];
  params: CatalogParam[];
}

export interface LabelledKey {
  key: string;
  label: string;
}

export interface PolicyTenant {
  id: string;
  slug: string;
  name: string;
  schema: string;
}

export interface CatalogData {
  groups: LabelledKey[];
  channels: LabelledKey[];
  origin_groups: LabelledKey[];
  events: CatalogEvent[];
  tenants: PolicyTenant[];
}

/** Cada folha carrega a procedência para a UI não ter de recalcular o default. */
export interface PolicyValue<T> {
  value: T;
  source: 'default' | 'tenant';
}

export interface PolicyEntry {
  channels: Record<string, PolicyValue<boolean>>;
  params: Record<string, PolicyValue<unknown>>;
  overridden: boolean;
}

export type ResolvedPolicy = Record<string, PolicyEntry>;

export interface PolicyPatch {
  [event: string]: {
    channels?: Partial<Record<NotificationChannel, boolean>>;
    params?: Record<string, unknown>;
  };
}

export interface PipelineStages {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

class NotificationPolicyService {
  async catalog(): Promise<CatalogData> {
    const res = await api.get('/super/notification_policies');
    return res.data.data;
  }

  async show(tenantId: string): Promise<{ tenant: PolicyTenant; policy: ResolvedPolicy }> {
    const res = await api.get(`/super/notification_policies/${tenantId}`);
    return res.data.data;
  }

  async update(tenantId: string, policy: PolicyPatch): Promise<{ policy: ResolvedPolicy }> {
    const res = await api.patch(`/super/notification_policies/${tenantId}`, { policy });
    return res.data.data;
  }

  /** Devolve UM evento ao padrão de fábrica. */
  async resetEvent(tenantId: string, event: string): Promise<{ policy: ResolvedPolicy }> {
    const res = await api.delete(
      `/super/notification_policies/${tenantId}/events/${encodeURIComponent(event)}`,
    );
    return res.data.data;
  }

  async applyToAll(
    tenantId: string,
    onlySlugs: string[] = [],
  ): Promise<{ applied: string[]; failed: { slug: string; error: string }[] }> {
    const res = await api.post(`/super/notification_policies/${tenantId}/apply_to_all`, {
      confirm: true,
      only_slugs: onlySlugs,
    });
    return res.data.data;
  }

  async stages(tenantId: string): Promise<PipelineStages[]> {
    const res = await api.get(`/super/notification_policies/${tenantId}/stages`);
    return res.data.data.pipelines;
  }
}

export default new NotificationPolicyService();
