import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { visitsService } from './visitsService';

vi.mock('@/services/core/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

describe('visitsService.feedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH /visits/:id/feedback com nota e comentário, e devolve a visita', async () => {
    const visita = { id: 'v1', status: 'completed', rating: 4, feedback_notes: 'Gostou' };
    vi.mocked(api.post).mockResolvedValue({ data: { data: visita } } as never);

    const r = await visitsService.feedback('v1', 4, 'Gostou');

    expect(api.post).toHaveBeenCalledWith('/visits/v1/feedback', { rating: 4, feedback_notes: 'Gostou' });
    expect(r).toEqual(visita);
  });

  it('manda só o que foi preenchido', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'v1' } } } as never);

    await visitsService.feedback('v1', undefined, 'Só comentário');
    expect(api.post).toHaveBeenLastCalledWith('/visits/v1/feedback', { feedback_notes: 'Só comentário' });

    await visitsService.feedback('v1', 5);
    expect(api.post).toHaveBeenLastCalledWith('/visits/v1/feedback', { rating: 5 });
  });
});

describe('visitsService.leadPickerPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pede a página e o tamanho e devolve o meta com o total', async () => {
    const meta = { total: 1240, page: 2, per_page: 50, has_more: true, only_mine: false, me: null };
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'c1', name: 'Leonardo Teste' }], meta } } as never);

    const r = await visitsService.leadPickerPage('leo', 2, 50);

    expect(api.get).toHaveBeenCalledWith('/visits/lead_picker', { params: { q: 'leo', page: 2, per_page: 50 } });
    expect(r.meta).toEqual(meta);
    expect(r.data).toHaveLength(1);
  });

  it('sem argumentos pede a 1ª página de 50; sem meta devolve meta vazio', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } } as never);

    const r = await visitsService.leadPickerPage();

    expect(api.get).toHaveBeenCalledWith('/visits/lead_picker', { params: { q: '', page: 1, per_page: 50 } });
    expect(r).toEqual({ data: [], meta: {} });
  });
});

describe('visitsService.leadPicker (Propostas)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('continua igual: só q e per_page, devolve a lista', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'c1' }] } } as never);

    const r = await visitsService.leadPicker('ana', 20);

    expect(api.get).toHaveBeenCalledWith('/visits/lead_picker', { params: { q: 'ana', per_page: 20 } });
    expect(r).toEqual([{ id: 'c1' }]);
  });
});

describe('visitsService.realtors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /visits/realtors devolve a lista de corretores', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'u1', name: 'Bruno' }] } } as never);

    const r = await visitsService.realtors();

    expect(api.get).toHaveBeenCalledWith('/visits/realtors');
    expect(r).toEqual([{ id: 'u1', name: 'Bruno' }]);
  });

  it('resposta sem data vira lista vazia', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} } as never);
    expect(await visitsService.realtors()).toEqual([]);
  });
});
