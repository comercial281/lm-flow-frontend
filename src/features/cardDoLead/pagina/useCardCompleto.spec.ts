// src/features/cardDoLead/pagina/useCardCompleto.spec.ts
// A página do card volta do servidor quando a guia volta a ficar visível: o card
// pode ter sido ganho, movido ou arquivado no quadro, em outra guia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import type { PipelineItemDetail } from '@/types/analytics';
import { buscarCardPeloId } from '../buscarCard';
import { useCardCompleto } from './useCardCompleto';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../buscarCard', () => ({ buscarCardPeloId: vi.fn() }));

const detalhe = (status: string) =>
  ({ item: { id: 'i1', pipeline_id: 'p1', status }, stage_durations: [], pipeline: { id: 'p1', name: 'Funil', stages: [] } }) as unknown as PipelineItemDetail;

let visibilidade: DocumentVisibilityState = 'visible';
const voltarParaAGuia = () => {
  visibilidade = 'visible';
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
};

describe('useCardCompleto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visibilidade = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);
  });
  afterEach(() => vi.restoreAllMocks());

  it('voltar para a guia recarrega o card em silêncio', async () => {
    vi.mocked(buscarCardPeloId).mockResolvedValueOnce({ tipo: 'achou', card: detalhe('open') } as never);
    const { result } = renderHook(() => useCardCompleto('p1', 'i1'));
    await waitFor(() => expect(result.current.estado.estado).toBe('pronto'));

    vi.mocked(buscarCardPeloId).mockResolvedValueOnce({ tipo: 'achou', card: detalhe('won') } as never);
    visibilidade = 'hidden';
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(buscarCardPeloId).toHaveBeenCalledTimes(1);
    voltarParaAGuia();

    await waitFor(() => {
      const e = result.current.estado;
      expect(e.estado === 'pronto' && e.dados.item.status).toBe('won');
    });
    expect(buscarCardPeloId).toHaveBeenCalledTimes(2);
  });

  it('falha ao recarregar na volta da guia: a tela fica como está, sem aviso', async () => {
    vi.mocked(buscarCardPeloId).mockResolvedValueOnce({ tipo: 'achou', card: detalhe('open') } as never);
    const { result } = renderHook(() => useCardCompleto('p1', 'i1'));
    await waitFor(() => expect(result.current.estado.estado).toBe('pronto'));

    vi.mocked(buscarCardPeloId).mockResolvedValueOnce({ tipo: 'erro' } as never);
    voltarParaAGuia();

    await waitFor(() => expect(buscarCardPeloId).toHaveBeenCalledTimes(2));
    expect(result.current.estado.estado).toBe('pronto');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
