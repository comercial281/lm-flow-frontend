import { describe, it, expect, vi } from 'vitest';
import api from '@/services/core/api';
import { labelsService } from './labelsService';

describe('labelsService.getLabels', () => {
  it('pede até 5000 e só pede contagem quando a tela quer', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [], meta: { pagination: {} } } } as never);
    await labelsService.getLabels();
    expect(get).toHaveBeenLastCalledWith('/labels', { params: { per_page: 5000 } });
    await labelsService.getLabels({ withCounts: true });
    expect(get).toHaveBeenLastCalledWith('/labels', { params: { per_page: 5000, with_counts: 1 } });
  });
});

describe('labelsService.shuffleColor', () => {
  it('faz POST em /labels/:id/shuffle_color e devolve a etiqueta pura', async () => {
    const etiqueta = { id: '7', title: 'x', color: '#3b82f6' };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true, data: etiqueta, meta: {} } } as never);
    const r = await labelsService.shuffleColor('7');
    expect(post).toHaveBeenCalledWith('/labels/7/shuffle_color');
    expect(r).toEqual(etiqueta);
  });
});
