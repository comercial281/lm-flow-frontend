import api from '@/services/core/api';
import type { UserFilters, UserProfile, UsersPage } from '@/types/admin/users';

interface Envelope<T> { success: boolean; data: T }

// 20 por página, como a lista de chamadas da tela de Custos (Tony, 03/10).
export const USUARIOS_POR_PAGINA = 20;

export const usersService = {
  async list(f: UserFilters): Promise<UsersPage> {
    const params: Record<string, string | number> = { per_page: USUARIOS_POR_PAGINA };
    const q = f.q.trim();
    if (q) params.q = q;
    if (f.tenant) params.tenant = f.tenant;
    if (f.role) params.role = f.role;
    if (f.situation) params.situation = f.situation;
    if (f.includeTeam) params.include_team = 'true';
    if (f.page > 1) params.page = f.page;
    const res = await api.get('/super/users', { params });
    return (res.data as Envelope<UsersPage>).data;
  },

  async profile(schema: string, userId: string): Promise<UserProfile> {
    const res = await api.get(`/super/users/${schema}/${userId}`);
    return (res.data as Envelope<UserProfile>).data;
  },

  async copyAccessLink(tenantId: string, userId: string): Promise<string | undefined> {
    const res = await api.post(`/super/pooled_tenants/${tenantId}/access_link`, { user_id: userId });
    return res.data?.data?.url;
  },

  async sendAccessLink(tenantId: string, userId: string): Promise<{ sent: boolean; instance?: string; error?: string; skipped?: string }> {
    const res = await api.post(`/super/pooled_tenants/${tenantId}/send_access_link`, { user_id: userId });
    return res.data?.whatsapp ?? { sent: false };
  },
};
