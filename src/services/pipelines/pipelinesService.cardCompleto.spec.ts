// Card completo (E4): um card só pelo id, e "Sobre o negócio" pelo PATCH de sempre.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pipelinesService } from './pipelinesService';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

beforeEach(() => {
  api.get.mockReset();
  api.patch.mockReset();
});

describe('pipelinesService · card completo', () => {
  it('getPipelineItem lê o card, os dias por etapa e o funil', async () => {
    const detalhe = {
      item: { id: 'i1', pipeline_id: 'p1', stage_id: 's1' },
      stage_durations: [{ stage_id: 's1', days: 2, current: true }],
      pipeline: { id: 'p1', name: 'Leads (Marketing)', stages: [] },
    };
    api.get.mockResolvedValue({ data: { success: true, data: detalhe } });

    await expect(pipelinesService.getPipelineItem('p1', 'i1')).resolves.toEqual(detalhe);
    expect(api.get).toHaveBeenCalledWith('/pipelines/p1/pipeline_items/i1');
  });

  it('getPipelineItem deixa o 404 subir (a tela decide o aviso)', async () => {
    const erro = Object.assign(new Error('404'), { response: { status: 404 } });
    api.get.mockRejectedValue(erro);

    await expect(pipelinesService.getPipelineItem('p1', 'x')).rejects.toBe(erro);
  });

  it('updateItemBusiness manda os campos dentro de pipeline_item', async () => {
    api.patch.mockResolvedValue({ data: { success: true, data: { id: 'i1', estimated_value: '450000.0' } } });

    const salvo = await pipelinesService.updateItemBusiness('p1', 'i1', { estimated_value: 450000 });

    expect(api.patch).toHaveBeenCalledWith('/pipelines/p1/pipeline_items/i1', {
      pipeline_item: { estimated_value: 450000 },
    });
    expect(salvo.estimated_value).toBe('450000.0');
  });
});
