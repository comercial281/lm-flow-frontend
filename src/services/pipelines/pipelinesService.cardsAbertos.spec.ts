import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { pipelinesService } from './pipelinesService';

vi.mock('@/services/core/api', () => ({ default: { get: vi.fn() } }));

// A tela Propostas pergunta de qual atendimento é a proposta (ajuste de 08/10).
describe('pipelinesService.getOpenCardsOfContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pede os cards abertos do lead e devolve a lista', async () => {
    const cards = [{ id: 'i1', pipeline_id: 'p1', pipeline_name: 'Vendas', stage_id: 's1', stage_name: 'Proposta', created_at: null }];
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: cards } } as never);

    expect(await pipelinesService.getOpenCardsOfContact('c1')).toEqual(cards);
    expect(api.get).toHaveBeenCalledWith('/pipelines/open_cards_by_contact/c1');
  });
});
