import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: http }));

import { propertyOwnersService } from './propertyOwnersService';

beforeEach(() => vi.clearAllMocks());

describe('propertyOwnersService', () => {
  it('conta e devolve número', async () => {
    http.get.mockResolvedValue({ data: { data: { count: 3 } } });
    await expect(propertyOwnersService.count()).resolves.toBe(3);
    expect(http.get).toHaveBeenCalledWith('/property_owners/count');
  });
  it('muda status pelo endereço próprio', async () => {
    http.patch.mockResolvedValue({ data: { data: { id: 'o1', status: 'unavailable' } } });
    await propertyOwnersService.mudarStatus('o1', 'unavailable');
    expect(http.patch).toHaveBeenCalledWith('/property_owners/o1/status', { status: 'unavailable' });
  });
  it('cria embrulhando em property_owner', async () => {
    http.post.mockResolvedValue({ data: { data: { id: 'o2' } } });
    await propertyOwnersService.create({ name: 'Ana', authorized_user_ids: ['u1'] });
    expect(http.post).toHaveBeenCalledWith('/property_owners', { property_owner: { name: 'Ana', authorized_user_ids: ['u1'] } });
  });
});
