import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { pipelinesService } from './pipelinesService';

vi.mock('@/services/core/api', () => ({ default: { get: vi.fn() } }));

describe('pipelinesService.getPipeline por aba', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 'p1', stages: [] } } } as never);
  });

  it('sem aba: a mesma chamada de sempre (o servidor devolve Abertos)', async () => {
    await pipelinesService.getPipeline('p1');
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1');
    expect(vi.mocked(api.get).mock.calls[0]).toHaveLength(1);
  });

  it('com aba: manda ?status=', async () => {
    const r = await pipelinesService.getPipeline('p1', { status: 'lost' });
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1', { params: { status: 'lost' } });
    expect(r).toEqual({ id: 'p1', stages: [] });
  });
});
