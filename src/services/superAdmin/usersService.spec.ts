import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, post: apiPost } }));

import { usersService } from './usersService';

describe('usersService', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it('lista manda só os filtros preenchidos, 20 por página', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { items: [], meta: { total: 0, page: 1, per_page: 20 }, tenants: [], roles: [], errors: [] } } });
    await usersService.list({ q: ' maria ', tenant: null, role: '', situation: 'sumido', includeTeam: false, page: 1 });
    expect(apiGet).toHaveBeenCalledWith('/super/users', { params: { per_page: 20, q: 'maria', situation: 'sumido' } });
    await usersService.list({ q: '', tenant: 'tenant_a', role: 'Gerente', situation: '', includeTeam: true, page: 3 });
    expect(apiGet).toHaveBeenLastCalledWith('/super/users', { params: { per_page: 20, tenant: 'tenant_a', role: 'Gerente', include_team: 'true', page: 3 } });
  });

  it('ficha pela chave cliente + id', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: { person: {} } } });
    await usersService.profile('tenant_a', 'u1');
    expect(apiGet).toHaveBeenCalledWith('/super/users/tenant_a/u1');
  });

  it('links de acesso usam os endpoints do cliente', async () => {
    apiPost.mockResolvedValueOnce({ data: { data: { url: 'https://x/link' } } });
    expect(await usersService.copyAccessLink('t1', 'u1')).toBe('https://x/link');
    expect(apiPost).toHaveBeenCalledWith('/super/pooled_tenants/t1/access_link', { user_id: 'u1' });
    apiPost.mockResolvedValueOnce({ data: { whatsapp: { sent: true, instance: 'Operacional (LM01)' } } });
    expect(await usersService.sendAccessLink('t1', 'u1')).toEqual({ sent: true, instance: 'Operacional (LM01)' });
    expect(apiPost).toHaveBeenLastCalledWith('/super/pooled_tenants/t1/send_access_link', { user_id: 'u1' });
  });
});
