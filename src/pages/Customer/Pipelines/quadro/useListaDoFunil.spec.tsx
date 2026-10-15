import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineItem } from '@/types/analytics';

vi.mock('@/services/pipelines', () => ({ pipelinesService: { getBoardItems: vi.fn() } }));
import { pipelinesService } from '@/services/pipelines';
import { useListaDoFunil } from './useListaDoFunil';

const item = (id: string) => ({ id }) as unknown as PipelineItem;
const props = { pipelineId: 'p1', params: { status: 'open' }, assinatura: 'a', ordem: 'desc' as const, ativo: true, versao: 0 };

describe('useListaDoFunil', () => {
  beforeEach(() => { vi.mocked(pipelinesService.getBoardItems).mockReset(); });

  it('só pede com a Lista aberta, na ordem de chegada escolhida', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockResolvedValue({ items: [item('a')], total: 1, has_more: false });
    const { result, rerender } = renderHook(p => useListaDoFunil(p), { initialProps: { ...props, ativo: false } });
    expect(pipelinesService.getBoardItems).not.toHaveBeenCalled();
    rerender({ ...props, ordem: 'asc' });
    await waitFor(() => expect(result.current.itens).toHaveLength(1));
    expect(pipelinesService.getBoardItems).toHaveBeenCalledWith('p1', { status: 'open' }, { offset: 0, limit: 30, sort: 'arrival_asc' });
  });

  it('carregar mais acrescenta; recarga (versao) relê até onde foi', async () => {
    vi.mocked(pipelinesService.getBoardItems)
      .mockResolvedValueOnce({ items: [item('a')], total: 2, has_more: true })
      .mockResolvedValueOnce({ items: [item('b')], total: 2, has_more: false })
      .mockResolvedValueOnce({ items: [item('a'), item('b')], total: 2, has_more: false });
    const { result, rerender } = renderHook(p => useListaDoFunil(p), { initialProps: props });
    await waitFor(() => expect(result.current.temMais).toBe(true));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.itens.map(i => i.id)).toEqual(['a', 'b']));
    rerender({ ...props, versao: 1 });
    await waitFor(() => expect(pipelinesService.getBoardItems).toHaveBeenLastCalledWith('p1', { status: 'open' }, { offset: 0, limit: 30, sort: 'arrival_desc' }));
    expect(result.current.itens.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('falha na primeira página é erro, não lista vazia', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockRejectedValue(new Error('caiu'));
    const { result } = renderHook(p => useListaDoFunil(p), { initialProps: props });
    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.itens).toEqual([]);
  });
});
