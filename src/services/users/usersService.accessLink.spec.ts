import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/services/core/apiAuth', () => ({ default: { post: (...a: unknown[]) => mocks.post(...a) } }));

import usersService from './usersService';

describe('usersService.accessLink', () => {
  it('pede um link novo e devolve o endereço', async () => {
    mocks.post.mockResolvedValue({ data: { success: true, data: { url: 'https://c.lmflow.com.br/acesso?t=x', expires_at: '2026-09-27T10:00:00Z' } } });
    await expect(usersService.accessLink('u1')).resolves.toEqual({ url: 'https://c.lmflow.com.br/acesso?t=x', expires_at: '2026-09-27T10:00:00Z' });
    expect(mocks.post).toHaveBeenCalledWith('/users/u1/access_link');
  });
});
