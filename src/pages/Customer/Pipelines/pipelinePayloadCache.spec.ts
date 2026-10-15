import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '@/types/analytics';

vi.mock('@/services/pipelines', () => ({
  pipelinesService: { getBoard: vi.fn() },
}));

import { pipelinesService } from '@/services/pipelines';

const funil = { id: 'p1', stages: [] } as unknown as Pipeline;

describe('pipelinePayloadCache', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    vi.mocked(pipelinesService.getBoard).mockReset();
  });

  it('o hover e o quadro dividem um pedido só da aba Abertos (o 1º lote, 30 por coluna)', async () => {
    let soltar!: (p: Pipeline) => void;
    vi.mocked(pipelinesService.getBoard).mockReturnValue(new Promise(r => (soltar = r)));
    const { prefetchPipeline, loadOpenPipeline, getCachedPipeline } = await import('./pipelinePayloadCache');

    prefetchPipeline('p1');
    const doQuadro = loadOpenPipeline('p1');
    soltar(funil);

    await expect(doQuadro).resolves.toBe(funil);
    expect(pipelinesService.getBoard).toHaveBeenCalledTimes(1);
    expect(pipelinesService.getBoard).toHaveBeenCalledWith('p1', { status: 'open' }, 30);
    expect(getCachedPipeline('p1')).toBe(funil);
  });

  it('terminado o pedido, a próxima carga pede de novo', async () => {
    vi.mocked(pipelinesService.getBoard).mockResolvedValue(funil);
    const { loadOpenPipeline } = await import('./pipelinePayloadCache');

    await loadOpenPipeline('p1');
    await loadOpenPipeline('p1');
    expect(pipelinesService.getBoard).toHaveBeenCalledTimes(2);
  });

  it('recarga depois de uma ação não se junta ao pedido que começou antes dela', async () => {
    const antigo = { id: 'p1', stages: [], name: 'antes' } as unknown as Pipeline;
    const novo = { id: 'p1', stages: [], name: 'depois' } as unknown as Pipeline;
    let soltarAntigo!: (p: Pipeline) => void;
    vi.mocked(pipelinesService.getBoard)
      .mockReturnValueOnce(new Promise(r => (soltarAntigo = r)))
      .mockResolvedValueOnce(novo);
    const { loadOpenPipeline, getCachedPipeline } = await import('./pipelinePayloadCache');

    const doPoll = loadOpenPipeline('p1');
    const depoisDaAcao = loadOpenPipeline('p1', { reaproveitar: false });

    await expect(depoisDaAcao).resolves.toBe(novo);
    soltarAntigo(antigo);
    await doPoll;
    expect(pipelinesService.getBoard).toHaveBeenCalledTimes(2);
    // o pedido velho, que terminou depois, não regrava o cache por cima do novo
    expect(getCachedPipeline('p1')).toBe(novo);
  });

  it('falha não fica guardada: não grava o cache e a próxima carga pede de novo', async () => {
    vi.mocked(pipelinesService.getBoard).mockRejectedValueOnce(new Error('caiu')).mockResolvedValueOnce(funil);
    const { loadOpenPipeline, getCachedPipeline } = await import('./pipelinePayloadCache');

    await expect(loadOpenPipeline('p1')).rejects.toThrow('caiu');
    expect(getCachedPipeline('p1')).toBeUndefined();
    await expect(loadOpenPipeline('p1')).resolves.toBe(funil);
  });

  it('o prefetch engole o erro, e o quadro que se juntou a ele recebe a falha', async () => {
    let falhar!: (e: Error) => void;
    vi.mocked(pipelinesService.getBoard).mockReturnValue(new Promise((_, rej) => (falhar = rej)));
    const { prefetchPipeline, loadOpenPipeline } = await import('./pipelinePayloadCache');

    prefetchPipeline('p1');
    const doQuadro = loadOpenPipeline('p1');
    falhar(new Error('caiu'));
    await expect(doQuadro).rejects.toThrow('caiu');
  });

  it('hover repetido dentro de 60 s com o funil guardado não pede de novo', async () => {
    vi.mocked(pipelinesService.getBoard).mockResolvedValue(funil);
    const { prefetchPipeline, loadOpenPipeline } = await import('./pipelinePayloadCache');

    await loadOpenPipeline('p1');
    prefetchPipeline('p1');
    expect(pipelinesService.getBoard).toHaveBeenCalledTimes(1);
  });
});
