import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineItem, PipelineStage } from '@/types/analytics';

vi.mock('@/services/pipelines', () => ({ pipelinesService: { getBoardItems: vi.fn() } }));
import { pipelinesService } from '@/services/pipelines';
import { useMaisCardsDaColuna } from './useMaisCardsDaColuna';

const item = (id: string) => ({ id }) as unknown as PipelineItem;
const coluna = (n: number, total: number) =>
  ({ id: 's1', name: 'Novo', items: Array.from({ length: n }, (_, i) => item(`i${i}`)), items_total: total }) as unknown as PipelineStage;

function usar(inicial: PipelineStage[], assinatura = 'a') {
  return renderHook(({ ass }) => {
    const [stages, setStages] = useState(inicial);
    const mais = useMaisCardsDaColuna({ pipelineId: 'p1', params: { status: 'open' }, assinatura: ass, setStages });
    return { stages, ...mais };
  }, { initialProps: { ass: assinatura } });
}

describe('useMaisCardsDaColuna', () => {
  // Com chaves: a seta devolveria o próprio mock, e o vitest o chamaria como limpeza
  // (a promessa que nunca resolve do 2º teste pendurava a suíte).
  beforeEach(() => { vi.mocked(pipelinesService.getBoardItems).mockReset(); });

  it('pede a partir do que já está carregado e junta sem repetir', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockResolvedValue({ items: [item('i29'), item('i30')], total: 31, has_more: false });
    const { result } = usar([coluna(30, 31)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.stages[0].items).toHaveLength(31));
    expect(pipelinesService.getBoardItems).toHaveBeenCalledWith('p1', { status: 'open' }, { stageId: 's1', offset: 30, limit: 30 });
    expect(result.current.stages[0].items_total).toBe(31);
  });

  it('coluna completa não pede; clique duplo não pede duas vezes', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockReturnValue(new Promise(() => {}));
    const { result } = usar([coluna(30, 30)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    expect(pipelinesService.getBoardItems).not.toHaveBeenCalled();
    const { result: r2 } = usar([coluna(30, 90)]);
    act(() => { r2.current.carregarMais(r2.current.stages[0]); r2.current.carregarMais(r2.current.stages[0]); });
    expect(pipelinesService.getBoardItems).toHaveBeenCalledTimes(1);
    expect(r2.current.carregando.s1).toBe(true);
  });

  it('página que chega depois de trocar o filtro é jogada fora', async () => {
    let soltar!: (v: { items: PipelineItem[]; total: number; has_more: boolean }) => void;
    vi.mocked(pipelinesService.getBoardItems).mockReturnValue(new Promise(r => { soltar = r; }));
    const { result, rerender } = usar([coluna(30, 90)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    rerender({ ass: 'b' });
    await act(async () => { soltar({ items: [item('velho')], total: 90, has_more: true }); });
    expect(result.current.stages[0].items).toHaveLength(30);
    expect(result.current.carregando.s1).toBeFalsy();
  });

  it('falha marca erro na coluna, e tentar de novo limpa', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockRejectedValueOnce(new Error('caiu'))
      .mockResolvedValueOnce({ items: [item('i30')], total: 31, has_more: false });
    const { result } = usar([coluna(30, 31)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.erro.s1).toBe(true));
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.stages[0].items).toHaveLength(31));
    expect(result.current.erro.s1).toBe(false);
  });

  it('página sem card novo esgota a coluna: nada automático repete, só o clique da pessoa', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockResolvedValue({ items: [], total: 90, has_more: true });
    const { result } = usar([coluna(30, 90)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.carregando.s1).toBe(false));
    act(() => result.current.carregarMais(result.current.stages[0]));
    act(() => result.current.carregarMais(result.current.stages[0]));
    expect(pipelinesService.getBoardItems).toHaveBeenCalledTimes(1);
    act(() => result.current.carregarMais(result.current.stages[0], { manual: true }));
    expect(pipelinesService.getBoardItems).toHaveBeenCalledTimes(2);
  });

  it('coluna esgotada com mais no servidor mostra o erro (com Tentar de novo), não para muda', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockResolvedValueOnce({ items: [item('i0')], total: 90, has_more: true })
      .mockResolvedValueOnce({ items: [item('i30')], total: 90, has_more: true });
    const { result } = usar([coluna(30, 90)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.erro.s1).toBe(true));
    act(() => result.current.carregarMais(result.current.stages[0], { manual: true }));
    await waitFor(() => expect(result.current.stages[0].items).toHaveLength(31));
    expect(result.current.erro.s1).toBe(false);
  });

  it('página vazia com a coluna completa no servidor não é erro', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockResolvedValue({ items: [], total: 30, has_more: false });
    const { result } = usar([coluna(30, 31)]);
    act(() => result.current.carregarMais(result.current.stages[0]));
    await waitFor(() => expect(result.current.carregando.s1).toBe(false));
    expect(result.current.erro.s1).toBe(false);
    expect(result.current.stages[0].items_total).toBe(30);
  });
});
