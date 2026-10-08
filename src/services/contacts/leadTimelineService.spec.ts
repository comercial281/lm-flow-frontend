// src/services/contacts/leadTimelineService.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { leadTimelineService } from './leadTimelineService';

vi.mock('@/services/core/api', () => ({ default: { get: vi.fn() } }));

const evento = {
  id: 'mov-1',
  category: 'alteracao',
  kind: 'stage_changed',
  title: 'Mudou de etapa',
  detail: 'Novo → 1º contato',
  actor: 'Ana Corretora',
  occurred_at: '2026-10-07T12:00:00.000000Z',
  pipeline_name: 'Leads (Marketing)',
  tone: 'neutral',
};

describe('leadTimelineService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /contacts/:id/timeline com filtro e before, e desembrulha a página do envelope da casa', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { events: [evento], next_before: '2026-10-07T11:00:00.000000Z' }, meta: {} },
    } as never);

    const r = await leadTimelineService.list('c1', { category: 'rodizio', before: '2026-10-08T00:00:00.000000Z' });

    expect(api.get).toHaveBeenCalledWith('/contacts/c1/timeline', {
      params: { category: 'rodizio', before: '2026-10-08T00:00:00.000000Z' },
    });
    expect(r).toEqual({ events: [evento], next_before: '2026-10-07T11:00:00.000000Z' });
  });

  it('sem filtro não manda parâmetro (o servidor entende Tudo); resposta torta vira página vazia', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: {}, meta: {} } } as never);

    const r = await leadTimelineService.list('c1');

    expect(api.get).toHaveBeenCalledWith('/contacts/c1/timeline', { params: {} });
    expect(r).toEqual({ events: [], next_before: null });
  });
});
