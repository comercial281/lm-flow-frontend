import apiClient from '@/services/core/api';

export type InstanceStatus = 'pending' | 'provisioning_railway' | 'active' | 'error';

export interface ClientInstance {
  id: number;
  name: string;
  slug: string;
  admin_email: string;
  admin_name: string | null;
  status: InstanceStatus;
  backend_url: string | null;
  frontend_link: string | null;
  error_message: string | null;
  provisioning_log: { time: string; message: string }[];
  created_at: string;
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
  list: () =>
    apiClient.get<{ data: ClientInstance[] }>('/client_instances'),

  get: (id: number) =>
    apiClient.get<{ data: ClientInstance }>(`/client_instances/${id}`),

  create: (payload: CreateClientInstancePayload) =>
    apiClient.post<{ data: ClientInstance }>('/client_instances', {
      client_instance: payload,
    }),

  delete: (id: number) =>
    apiClient.delete(`/client_instances/${id}`),

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
};

export default clientInstancesService;
