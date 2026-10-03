import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: http }));

import { propertyCaptureRequestsService } from './propertyCaptureRequestsService';

beforeEach(() => vi.clearAllMocks());

describe('propertyCaptureRequestsService', () => {
  it('approve lê property_id de dentro do envelope do servidor', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: { id: 'c1', property_id: 'p9' }, meta: {} } });
    await expect(propertyCaptureRequestsService.approve('c1')).resolves.toEqual({ id: 'c1', property_id: 'p9' });
    expect(http.post).toHaveBeenCalledWith('/property_capture_requests/c1/approve');
  });

  it('reject devolve o pedido de dentro do envelope', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: { id: 'c1', status: 'rejected' } } });
    await expect(propertyCaptureRequestsService.reject('c1', 'x')).resolves.toMatchObject({ status: 'rejected' });
  });
});
