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

describe('quadro em lotes', () => {
  it('getBoard manda os parâmetros e o tamanho do lote', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { id: 'p1', stages: [] } } } as never);
    await pipelinesService.getBoard('p1', { status: 'open', q: 'maria' }, 30);
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1', { params: { status: 'open', q: 'maria', per_stage: 30 } });
  });

  it('getBoardItems pede mais de uma coluna', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { items: [], total: 0, has_more: false } } } as never);
    await pipelinesService.getBoardItems('p1', { status: 'open' }, { stageId: 's1', offset: 30, limit: 30 });
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1/board_items', {
      params: { status: 'open', stage_id: 's1', offset: 30, limit: 30, sort: 'position' },
    });
  });

  it('getBoardFacets pede as opções da aba', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { origins: [], assignees: [], unassigned: false } } } as never);
    await pipelinesService.getBoardFacets('p1', 'lost');
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1/board_facets', { params: { status: 'lost' } });
  });
});
