import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/pipelines', () => ({ pipelinesService: { getBoardFacets: vi.fn() } }));
import { pipelinesService } from '@/services/pipelines';
import { useFacetasDoQuadro } from './useFacetasDoQuadro';

const FACETAS = { origins: ['portal'], assignees: [], unassigned: false };

describe('useFacetasDoQuadro', () => {
  beforeEach(() => vi.mocked(pipelinesService.getBoardFacets).mockReset());

  it('só pede com o painel aberto', async () => {
    vi.mocked(pipelinesService.getBoardFacets).mockResolvedValue(FACETAS);
    const { result, rerender } = renderHook(({ ativo }) => useFacetasDoQuadro('p1', 'open', ativo), { initialProps: { ativo: false } });
    expect(pipelinesService.getBoardFacets).not.toHaveBeenCalled();
    rerender({ ativo: true });
    await waitFor(() => expect(result.current.facetas).toEqual(FACETAS));
  });

  it('falha vira erro (nunca lista vazia) e tenta de novo', async () => {
    vi.mocked(pipelinesService.getBoardFacets).mockRejectedValueOnce(new Error('caiu')).mockResolvedValueOnce(FACETAS);
    const { result } = renderHook(() => useFacetasDoQuadro('p1', 'open', true));
    await waitFor(() => expect(result.current.erro).toBe(true));
    act(() => result.current.tentarDeNovo());
    await waitFor(() => expect(result.current.facetas).toEqual(FACETAS));
    expect(result.current.erro).toBe(false);
  });
});
