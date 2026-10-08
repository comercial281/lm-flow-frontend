import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarCardPeloId } from './buscarCard';

const getPipelineItem = vi.hoisted(() => vi.fn());
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { getPipelineItem } }));

const erroHttp = (status?: number) => Object.assign(new Error('falhou'), status ? { response: { status } } : {});

beforeEach(() => { getPipelineItem.mockReset(); });

describe('buscarCardPeloId', () => {
  it('achou: devolve o card', async () => {
    const card = { item: { id: 'i1' }, stage_durations: [], pipeline: { id: 'p1', name: 'Leads', stages: [] } };
    getPipelineItem.mockResolvedValue(card);
    await expect(buscarCardPeloId('p1', 'i1')).resolves.toEqual({ tipo: 'achou', card });
  });

  it.each([404, 403])('%i é "sem acesso" (o servidor não diz se é outro dono ou apagado)', async status => {
    getPipelineItem.mockRejectedValue(erroHttp(status));
    await expect(buscarCardPeloId('p1', 'i1')).resolves.toEqual({ tipo: 'sem-acesso' });
  });

  it.each([500, undefined])('falha de servidor ou de rede (%s) é erro, com volta', async status => {
    getPipelineItem.mockRejectedValue(erroHttp(status));
    await expect(buscarCardPeloId('p1', 'i1')).resolves.toEqual({ tipo: 'erro' });
  });
});
