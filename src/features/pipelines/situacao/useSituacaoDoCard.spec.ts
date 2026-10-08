// src/features/pipelines/situacao/useSituacaoDoCard.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineItem } from '@/types/analytics';
import { useSituacaoDoCard } from './useSituacaoDoCard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { setItemStatus: vi.fn() } }));

const aberto = { id: 'i1', pipeline_id: 'p1', stage_id: 's2', status: 'open' } as unknown as PipelineItem;

describe('useSituacaoDoCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Ganho grava, troca a situação e avisa quem abriu o card', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue({ ...aberto, status: 'won', won_at: '2026-10-07T12:00:00Z' });
    const onMudou = vi.fn();
    const { result } = renderHook(() => useSituacaoDoCard(aberto, { onMudou }));

    await act(async () => { await result.current.marcarGanho(); });

    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'won' });
    expect(result.current.situacao).toBe('won');
    expect(result.current.fechado).toBe(true);
    expect(onMudou).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'won', stage_id: 's2' }));
    expect(toast.success).toHaveBeenCalledWith('Lead marcado como ganho.');
  });

  it('clique duplo: a segunda ação, com a primeira no ar, não sai', async () => {
    let soltar: (v: PipelineItem) => void = () => {};
    vi.mocked(pipelinesService.setItemStatus).mockReturnValue(new Promise(r => { soltar = r; }));
    const { result } = renderHook(() => useSituacaoDoCard(aberto));

    let primeira: Promise<boolean> = Promise.resolve(false);
    let segunda: Promise<boolean> = Promise.resolve(false);
    act(() => {
      primeira = result.current.marcarGanho();
      segunda = result.current.marcarGanho();
    });
    expect(result.current.salvando).toBe('won');
    await act(async () => { soltar({ ...aberto, status: 'won' }); await primeira; });

    expect(await segunda).toBe(false);
    expect(pipelinesService.setItemStatus).toHaveBeenCalledTimes(1);
    expect(result.current.salvando).toBeNull();
  });

  it('a mesma situação não chama o servidor', async () => {
    const ganho = { ...aberto, status: 'won' } as PipelineItem;
    const { result } = renderHook(() => useSituacaoDoCard(ganho));
    await act(async () => { expect(await result.current.marcarGanho()).toBe(true); });
    expect(pipelinesService.setItemStatus).not.toHaveBeenCalled();
  });

  it('Perdido manda motivo e comentário limpo, e fecha a janela do motivo', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue({
      ...aberto, status: 'lost', lost_reason: { id: 'm1', label: 'Adiou a compra' },
    } as PipelineItem);
    const { result } = renderHook(() => useSituacaoDoCard(aberto));

    act(() => result.current.pedirPerdido());
    expect(result.current.perdidoAberto).toBe(true);
    await act(async () => { await result.current.confirmarPerdido('m1', '  Volta em março  '); });

    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', {
      status: 'lost', reason_option_id: 'm1', note: 'Volta em março',
    });
    expect(result.current.perdidoAberto).toBe(false);
    expect(result.current.situacao).toBe('lost');
  });

  it('comentário em branco não vai', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue({ ...aberto, status: 'lost' } as PipelineItem);
    const { result } = renderHook(() => useSituacaoDoCard(aberto));
    await act(async () => { await result.current.confirmarPerdido('m1', '   '); });
    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'lost', reason_option_id: 'm1' });
  });

  it('recusa do servidor: mostra a frase dele, a situação fica e a janela continua aberta', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockRejectedValue({
      response: { status: 422, data: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Esse motivo foi arquivado. Escolha outro.' } } },
    });
    const { result } = renderHook(() => useSituacaoDoCard(aberto));

    act(() => result.current.pedirPerdido());
    await act(async () => { expect(await result.current.confirmarPerdido('m-velho', '')).toBe(false); });

    expect(toast.error).toHaveBeenCalledWith('Esse motivo foi arquivado. Escolha outro.');
    expect(result.current.situacao).toBe('open');
    expect(result.current.perdidoAberto).toBe(true);
  });

  it('Reabrir manda open', async () => {
    const perdido = { ...aberto, status: 'lost' } as PipelineItem;
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue({ ...perdido, status: 'open', lost_reason: null } as PipelineItem);
    const { result } = renderHook(() => useSituacaoDoCard(perdido));
    await act(async () => { await result.current.reabrir(); });
    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'open' });
    expect(result.current.situacao).toBe('open');
    expect(toast.success).toHaveBeenCalledWith('Lead reaberto.');
  });

  it('outro card aberto na mesma janela: acompanha', () => {
    const { result, rerender } = renderHook(({ item }) => useSituacaoDoCard(item), { initialProps: { item: aberto } });
    rerender({ item: { ...aberto, id: 'i2', status: 'lost' } as PipelineItem });
    expect(result.current.item?.id).toBe('i2');
    expect(result.current.situacao).toBe('lost');
  });
});
