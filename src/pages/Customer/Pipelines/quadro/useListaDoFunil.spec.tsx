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

  it('falha do carregar mais não vira erro da primeira página; tentar de novo pede a mesma página', async () => {
    vi.mocked(pipelinesService.getBoardItems)
      .mockResolvedValueOnce({ items: [item('a')], total: 2, has_more: true })
      .mockRejectedValueOnce(new Error('caiu'))
      .mockResolvedValueOnce({ items: [item('b')], total: 2, has_more: false });
    const { result } = renderHook(p => useListaDoFunil(p), { initialProps: props });
    await waitFor(() => expect(result.current.temMais).toBe(true));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.erroAoCarregarMais).toBe(true));
    expect(result.current.erro).toBe(false);
    expect(result.current.itens.map(i => i.id)).toEqual(['a']);
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.itens.map(i => i.id)).toEqual(['a', 'b']));
    expect(result.current.erroAoCarregarMais).toBe(false);
    expect(pipelinesService.getBoardItems).toHaveBeenLastCalledWith('p1', { status: 'open' }, { offset: 1, limit: 30, sort: 'arrival_desc' });
  });

  it('trocar de funil com a Lista aberta volta pros 30 primeiros do funil novo', async () => {
    let soltar!: (v: { items: PipelineItem[]; total: number; has_more: boolean }) => void;
    vi.mocked(pipelinesService.getBoardItems)
      .mockResolvedValueOnce({ items: [item('a')], total: 2, has_more: true })
      .mockResolvedValueOnce({ items: [item('b')], total: 2, has_more: false })
      .mockReturnValueOnce(new Promise(r => { soltar = r; }));
    const { result, rerender } = renderHook(p => useListaDoFunil(p), { initialProps: props });
    await waitFor(() => expect(result.current.temMais).toBe(true));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.itens).toHaveLength(2));
    rerender({ ...props, pipelineId: 'p2' });
    // As linhas do funil anterior somem na hora (nunca ficam por cima do funil novo).
    expect(result.current.itens).toEqual([]);
    expect(result.current.carregando).toBe(true);
    await act(async () => { soltar({ items: [item('z')], total: 1, has_more: false }); });
    await waitFor(() => expect(result.current.itens.map(i => i.id)).toEqual(['z']));
    expect(pipelinesService.getBoardItems).toHaveBeenLastCalledWith('p2', { status: 'open' }, { offset: 0, limit: 30, sort: 'arrival_desc' });
  });

  it('falha na primeira página é erro, não lista vazia', async () => {
    vi.mocked(pipelinesService.getBoardItems).mockRejectedValue(new Error('caiu'));
    const { result } = renderHook(p => useListaDoFunil(p), { initialProps: props });
    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.itens).toEqual([]);
  });
});
