import apiClient from '@/services/core/api';

export interface LogClient {
  id: string;
  name: string;
  master?: boolean;
  slug?: string;
  has_backend?: boolean;
}

export interface ActivityEvent {
  id: string;
  occurred_at: string;
  source: string;
  category: string;
  action: string;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string | null;
  actor?: { id?: string; name?: string; email?: string; type?: string };
  subject?: { type?: string; id?: string };
  http?: { method?: string; endpoint?: string; status?: number };
  ip_address?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ActivityResponse {
  events: ActivityEvent[];
  server_time: string;
  categories?: Record<string, number>;
  unavailable?: boolean;
}

export interface ActivityParams {
  client?: string;
  category?: string;
  level?: string;
  q?: string;
  actor_id?: string;
  since?: string;
  before?: string;
  limit?: number;
  include_raw?: boolean;
  include_internal?: boolean;
}

export interface Whoami {
  email?: string;
  is_owner: boolean;
  is_admin: boolean;
  is_internal: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  can_access_admin: boolean;
  active: boolean;
  owner: boolean;
  added_by?: string;
  created_at?: string;
}

export interface UserMetricRow {
  user_id: string;
  name: string;
  email?: string;
  accesses: number;
  total_seconds: number;
  avg_seconds: number;
  last_seen_at: string | null;
  first_seen_at: string | null;
  clicks: number;
  screens: number;
  online: boolean;
}

export interface UserMetricsResponse {
  users: UserMetricRow[];
  overview: { total_users: number; online_now: number; total_seconds: number; total_accesses: number };
  server_time: string;
  unavailable?: boolean;
}

export interface UserMetricDetail {
  user: { id: string; name?: string; email?: string };
  sessions: Array<{
    id: string; started_at: string; ended_at: string | null; last_seen_at: string;
    duration_seconds: number; clicks: number; screens: number; ip?: string;
    end_reason?: string; online: boolean;
  }>;
  time_per_screen: Array<{ screen: string; seconds: number; visits: number }>;
  clicks_per_screen: Array<{ screen: string; clicks: number }>;
  top_elements: Array<{ label: string; clicks: number }>;
  hourly: Array<{ hour: number; accesses: number }>;
  totals: { accesses: number; total_seconds: number; total_clicks: number };
  server_time: string;
  unavailable?: boolean;
}

const superLogsService = {
  logClients: () => apiClient.get<{ data: { clients: LogClient[] } }>('/super/log_clients'),
  activity: (params: ActivityParams) => apiClient.get<{ data: ActivityResponse }>('/super/activity', { params }),
  userMetrics: (client: string, includeInternal = false) =>
    apiClient.get<{ data: UserMetricsResponse }>('/super/user_metrics', {
      params: { client, include_internal: includeInternal || undefined },
    }),
  userMetricDetail: (client: string, userId: string) =>
    apiClient.get<{ data: UserMetricDetail }>(`/super/user_metrics/${userId}`, { params: { client } }),

  // Equipe Leal Mídia + quem sou eu (pro gate do admin)
  whoami: () => apiClient.get<{ data: Whoami }>('/super/whoami'),
  team: () => apiClient.get<{ data: { members: TeamMember[] } }>('/super/team'),
  addMember: (payload: { email: string; name?: string; can_access_admin?: boolean }) =>
    apiClient.post<{ data: { member: TeamMember } }>('/super/team', payload),
  updateMember: (id: string, payload: Partial<Pick<TeamMember, 'name' | 'can_access_admin' | 'active'>>) =>
    apiClient.patch<{ data: { member: TeamMember } }>(`/super/team/${id}`, payload),
  removeMember: (id: string) => apiClient.delete(`/super/team/${id}`),
};

export default superLogsService;
