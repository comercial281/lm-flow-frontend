import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { pipelinesService } from './pipelinesService';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

// Situação do card (spec funil §3.2): Ganho, Perdido e Reabrir vão numa rota só.
describe('pipelinesService.setItemStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH na rota de situação com motivo e comentário, e devolve o card', async () => {
    const card = { id: 'i1', status: 'lost', lost_reason: { id: 'm1', label: 'Adiou a compra' } };
    vi.mocked(api.patch).mockResolvedValue({ data: { data: card } } as never);

    const r = await pipelinesService.setItemStatus('p1', 'i1', {
      status: 'lost', reason_option_id: 'm1', note: 'Volta a falar em março',
    });

    expect(api.patch).toHaveBeenCalledWith('/pipelines/p1/pipeline_items/i1/status', {
      status: 'lost', reason_option_id: 'm1', note: 'Volta a falar em março',
    });
    expect(r).toEqual(card);
  });

  it('Ganho e Reabrir mandam só a situação', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 'i1', status: 'won' } } } as never);

    await pipelinesService.setItemStatus('p1', 'i1', { status: 'won' });
    expect(api.patch).toHaveBeenLastCalledWith('/pipelines/p1/pipeline_items/i1/status', { status: 'won' });

    await pipelinesService.setItemStatus('p1', 'i1', { status: 'open' });
    expect(api.patch).toHaveBeenLastCalledWith('/pipelines/p1/pipeline_items/i1/status', { status: 'open' });
  });
});
