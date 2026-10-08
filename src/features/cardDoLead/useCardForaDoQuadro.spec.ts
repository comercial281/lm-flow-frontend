// Review Focus 5 no quadro: o link ?card= de um card que não está nos cards
// carregados abre, ou avisa — nunca some calado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { avisoDoCardForaDoQuadro, useCardForaDoQuadro } from './useCardForaDoQuadro';

const getPipelineItem = vi.hoisted(() => vi.fn());
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { getPipelineItem } }));

const detalhe = (item: Record<string, unknown>) => ({
  item: { id: 'i9', pipeline_id: 'p1', stage_id: 's1', ...item },
  stage_durations: [],
  pipeline: { id: 'p1', name: 'Leads', stages: [] },
});
const erroHttp = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => { getPipelineItem.mockReset(); });

describe('useCardForaDoQuadro', () => {
  it('sem card no endereço (ou o quadro ainda carregando): não busca nada', () => {
    const { result } = renderHook(() => useCardForaDoQuadro('p1', null));
    expect(result.current).toEqual({ estado: 'nada' });
    expect(getPipelineItem).not.toHaveBeenCalled();
  });

  it.each([
    ['arquivado', { archived_at: '2026-10-01T10:00:00Z' }],
    ['de outra aba (perdido)', { status: 'lost' }],
    ['de outra aba (ganho)', { status: 'won' }],
  ])('card %s: busca pelo id e devolve o card pra abrir a janela', async (_caso, campos) => {
    getPipelineItem.mockResolvedValue(detalhe(campos));
    const { result } = renderHook(() => useCardForaDoQuadro('p1', 'i9'));

    expect(result.current).toEqual({ estado: 'buscando' });
    await waitFor(() => expect(result.current.estado).toBe('achou'));
    expect(getPipelineItem).toHaveBeenCalledWith('p1', 'i9');
    expect(result.current).toMatchObject({ item: { id: 'i9', ...campos } });
    expect(avisoDoCardForaDoQuadro(result.current)).toBeNull();
  });

  it.each([
    ['de outro corretor', 404],
    ['apagado', 404],
    ['recusado pelo cargo', 403],
  ])('card %s: "Você não tem acesso a este lead"', async (_caso, status) => {
    getPipelineItem.mockRejectedValue(erroHttp(status));
    const { result } = renderHook(() => useCardForaDoQuadro('p1', 'i9'));

    await waitFor(() => expect(result.current.estado).toBe('sem-acesso'));
    expect(avisoDoCardForaDoQuadro(result.current)).toBe('Você não tem acesso a este lead');
  });

  it('servidor fora: avisa e "Tentar de novo" busca outra vez', async () => {
    getPipelineItem.mockRejectedValueOnce(erroHttp(500)).mockResolvedValueOnce(detalhe({}));
    const { result } = renderHook(() => useCardForaDoQuadro('p1', 'i9'));

    await waitFor(() => expect(result.current.estado).toBe('erro'));
    expect(avisoDoCardForaDoQuadro(result.current)).toBe('Não consegui abrir este lead.');
    act(() => {
      if (result.current.estado === 'erro') result.current.tentarDeNovo();
    });
    await waitFor(() => expect(result.current.estado).toBe('achou'));
    expect(getPipelineItem).toHaveBeenCalledTimes(2);
  });

  it('F5: a busca só começa quando o quadro carregou e o id chega', async () => {
    getPipelineItem.mockResolvedValue(detalhe({}));
    const { result, rerender } = renderHook(({ id }) => useCardForaDoQuadro('p1', id), {
      initialProps: { id: null as string | null },
    });
    expect(getPipelineItem).not.toHaveBeenCalled();

    rerender({ id: 'i9' });
    await waitFor(() => expect(result.current.estado).toBe('achou'));
  });

  it('resposta atrasada do card anterior não sobrescreve a do card novo', async () => {
    let soltarAntigo: (v: unknown) => void = () => {};
    getPipelineItem
      .mockImplementationOnce(() => new Promise(r => { soltarAntigo = r; }))
      .mockResolvedValueOnce(detalhe({ id: 'novo' }));
    const { result, rerender } = renderHook(({ id }) => useCardForaDoQuadro('p1', id), {
      initialProps: { id: 'antigo' as string | null },
    });

    rerender({ id: 'novo' });
    await waitFor(() => expect(result.current).toMatchObject({ estado: 'achou', item: { id: 'novo' } }));
    await act(async () => { soltarAntigo(detalhe({ id: 'antigo' })); });
    expect(result.current).toMatchObject({ item: { id: 'novo' } });
  });
});
