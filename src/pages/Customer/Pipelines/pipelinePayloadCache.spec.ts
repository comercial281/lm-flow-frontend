import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '@/types/analytics';

vi.mock('@/services/pipelines', () => ({
  pipelinesService: { getPipeline: vi.fn() },
}));

import { pipelinesService } from '@/services/pipelines';

const funil = { id: 'p1', stages: [] } as unknown as Pipeline;

describe('pipelinePayloadCache', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    vi.mocked(pipelinesService.getPipeline).mockReset();
  });

  it('o hover e o quadro dividem um pedido só da aba Abertos', async () => {
    let soltar!: (p: Pipeline) => void;
    vi.mocked(pipelinesService.getPipeline).mockReturnValue(new Promise(r => (soltar = r)));
    const { prefetchPipeline, loadOpenPipeline, getCachedPipeline } = await import('./pipelinePayloadCache');

    prefetchPipeline('p1');
    const doQuadro = loadOpenPipeline('p1');
    soltar(funil);

    await expect(doQuadro).resolves.toBe(funil);
    expect(pipelinesService.getPipeline).toHaveBeenCalledTimes(1);
    expect(pipelinesService.getPipeline).toHaveBeenCalledWith('p1', { status: 'open' });
    expect(getCachedPipeline('p1')).toBe(funil);
  });

  it('terminado o pedido, a próxima carga pede de novo', async () => {
    vi.mocked(pipelinesService.getPipeline).mockResolvedValue(funil);
    const { loadOpenPipeline } = await import('./pipelinePayloadCache');

    await loadOpenPipeline('p1');
    await loadOpenPipeline('p1');
    expect(pipelinesService.getPipeline).toHaveBeenCalledTimes(2);
  });
});
