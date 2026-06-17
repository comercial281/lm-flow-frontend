import apiClient from '@/services/core/api';

export interface MonitoringWhatsapp {
  inbox: string | null;
  provider: string;
  reauth_required: boolean;
  connection: Record<string, unknown>;
}

export interface MonitoringTenant {
  name: string;
  master: boolean;
  backend_url: string;
  frontend_url: string | null;
  frontend_status: number | null;
  online: boolean;
  api_up: boolean;
  last_inbound_at: string | null;
  minutes_since_last_inbound: number | null;
  inbound_24h: number;
  reauth_required: boolean;
  whatsapp: MonitoringWhatsapp[];
}

export interface MonitoringData {
  tenants: MonitoringTenant[];
  generated_at: string;
  overview: {
    total: number;
    online: number;
    total_inbound_24h: number;
    channels_total: number;
    channels_off: number;
    alerts: number;
  };
}

export type InstanceStatus = 'pending' | 'provisioning_railway' | 'active' | 'error';

export interface ClientInstanceSnapshot {
  date: string;
  backend_reachable: boolean;
  evolution_connected: boolean;
  leads_count: number;
  conversations_count: number;
  messages_count: number;
  inboxes_count: number;
  railway_monthly_cost_brl: number | null;
  evolution_cost_brl: number | null;
  total_monthly_cost_brl: number | null;
  total_monthly_cost_cents: number | null;
}

export interface ClientInstance {
  id: number;
  name: string;
  slug: string;
  admin_email: string;
  admin_name: string | null;
  status: InstanceStatus;
  archived_at: string | null;
  backend_url: string | null;
  frontend_link: string | null;
  error_message: string | null;
  provisioning_log: { time: string; message: string }[];
  enabled_features?: Record<string, boolean>;
  resolved_features?: Record<string, boolean>;
  created_at: string;
  snapshot?: ClientInstanceSnapshot | null;
}

export interface DashboardOverview {
  total_count: number;
  healthy_count: number;
  total_monthly_cost_brl: number;
  total_leads: number;
  total_conversations: number;
  total_messages: number;
}

export interface DashboardData {
  instances: ClientInstance[];
  overview: DashboardOverview;
}

export interface FeatureCatalogItem {
  key: string;
  label: string;
  group: 'menus' | 'settings' | string;
}

export interface AutomationItem {
  source: 'n8n' | 'make';
  external_id: number | string;
  name: string;
  raw_name: string;
  active: boolean;
  client: string;
  internal: boolean;
  mislabeled: boolean;
  link: string;
}

export interface AutomationGroup {
  client: string;
  internal: boolean;
  total: number;
  active: number;
  inactive: number;
  mislabeled: number;
  automations: AutomationItem[];
}

export interface AutomationsMonitorData {
  groups: AutomationGroup[];
  generated_at: string;
  overview: {
    clients: number;
    automations: number;
    active: number;
    inactive: number;
    mislabeled: number;
    sources: { n8n: number; make: number };
  };
  errors: string[];
}

export interface CreateClientInstancePayload {
  name: string;
  admin_email: string;
  admin_name?: string;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  chave_role: 'admin' | 'manager' | 'agent';
  role?: { key?: string; name?: string; color?: string };
  custom_role_id?: number | null;
  availability_status?: string;
  has_stored_password: boolean;
  password_set_at: string | null;
  password_set_by: string | null;
  password_stale: boolean;
  generated_password?: string | null; // only present in create/reset responses
}

export interface CreateTenantUserPayload {
  email: string;
  name: string;
  password?: string;
  chave_role?: 'admin' | 'manager' | 'agent';
  remember_password?: boolean;
}

const clientInstancesService = {
  list: (archived = false) =>
    apiClient.get<{ data: ClientInstance[] }>('/client_instances', { params: { archived } }),

  dashboard: () =>
    apiClient.get<{ success: boolean; data: DashboardData }>('/client_instances/dashboard'),

  monitoring: () =>
    apiClient.get<{ success: boolean; data: MonitoringData }>('/super/monitoring'),

  automations: () =>
    apiClient.get<{ success: boolean; data: AutomationsMonitorData }>('/super/automations'),

  archive: (id: number) =>
    apiClient.post<{ success: boolean; data: ClientInstance }>(`/client_instances/${id}/archive`, {}),

  unarchive: (id: number) =>
    apiClient.post<{ success: boolean; data: ClientInstance }>(`/client_instances/${id}/unarchive`, {}),

  get: (id: number) =>
    apiClient.get<{ data: ClientInstance }>(`/client_instances/${id}`),

  create: (payload: CreateClientInstancePayload) =>
    apiClient.post<{ data: ClientInstance }>('/client_instances', {
      client_instance: payload,
    }),

  delete: (id: number) =>
    apiClient.delete(`/client_instances/${id}`),

  // Master SSO: token do super-admin no tenant pra entrar sem senha
  sso: (id: number) =>
    apiClient.post<{ data: { token: string; frontend_url: string; name: string } }>(
      `/client_instances/${id}/sso`, {}
    ),

  // --- Tenant members ---

  listMembers: (id: number) =>
    apiClient.get<{ success: boolean; data: TenantUser[] }>(`/client_instances/${id}/users`),

  addMember: (id: number, payload: CreateTenantUserPayload) =>
    apiClient.post<{ success: boolean; data: TenantUser }>(
      `/client_instances/${id}/users`, payload
    ),

  updateMember: (id: number, userId: string, patch: Partial<{ name: string; email: string; chave_role: string }>) =>
    apiClient.patch<{ success: boolean; data: TenantUser }>(
      `/client_instances/${id}/users/${userId}`, patch
    ),

  removeMember: (id: number, userId: string) =>
    apiClient.delete(`/client_instances/${id}/users/${userId}`),

  resetMemberPassword: (id: number, userId: string) =>
    apiClient.post<{ success: boolean; data: TenantUser; message: string }>(
      `/client_instances/${id}/users/${userId}/reset_password`, {}
    ),

  setMemberPassword: (id: number, userId: string, password: string) =>
    apiClient.post<{ success: boolean; data: TenantUser }>(
      `/client_instances/${id}/users/${userId}/set_password`, { password }
    ),

  revealMemberPassword: (id: number, userId: string) =>
    apiClient.post<{ success: boolean; data: { password: string | null; stale: boolean; reason?: string; password_set_at?: string; password_set_by?: string } }>(
      `/client_instances/${id}/users/${userId}/reveal_password`, {}
    ),

  // --- Feature flags por tenant ---

  featureCatalog: () =>
    apiClient.get<{ data: FeatureCatalogItem[] }>('/client_instances/feature_catalog/list'),

  updateFeatures: (id: number, features: Record<string, boolean>) =>
    apiClient.patch<{ data: ClientInstance }>(`/client_instances/${id}/features`, { features }),

  // --- Vercel deploy sync ---

  syncFrontend: (id: number) =>
    apiClient.post<{ success: boolean; message: string; data: { url: string; id: string } }>(
      `/client_instances/${id}/sync_frontend`, {}
    ),

  syncAllFrontends: () =>
    apiClient.post<{ success: boolean; message: string; data: { id: number; name: string; success: boolean; url?: string; deploy_id?: string; error?: string }[] }>(
      '/client_instances/sync_all_frontends', {}
    ),
};

export default clientInstancesService;
