import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { visitsService } from './visitsService';

vi.mock('@/services/core/api', () => ({
  default: { patch: vi.fn() },
}));

describe('visitsService.feedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH /visits/:id/feedback com nota e comentário, e devolve a visita', async () => {
    const visita = { id: 'v1', status: 'completed', rating: 4, feedback_notes: 'Gostou' };
    vi.mocked(api.patch).mockResolvedValue({ data: { data: visita } } as never);

    const r = await visitsService.feedback('v1', 4, 'Gostou');

    expect(api.patch).toHaveBeenCalledWith('/visits/v1/feedback', { rating: 4, feedback_notes: 'Gostou' });
    expect(r).toEqual(visita);
  });

  it('manda só o que foi preenchido', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 'v1' } } } as never);

    await visitsService.feedback('v1', undefined, 'Só comentário');
    expect(api.patch).toHaveBeenLastCalledWith('/visits/v1/feedback', { feedback_notes: 'Só comentário' });

    await visitsService.feedback('v1', 5);
    expect(api.patch).toHaveBeenLastCalledWith('/visits/v1/feedback', { rating: 5 });
  });
});
