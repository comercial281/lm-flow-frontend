import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { useBoardDrag } from './useBoardDrag';

// Fase 2 do follow-up (20/10/2026): soltar o card na coluna Follow-up não move
// o card; abre a janela "Colocar em follow-up". Quem move é o servidor, quando
// o follow-up começa. Cancelar deixa o card onde estava.

const reorderItem = vi.fn();
const setItemStatus = vi.fn();
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    reorderItem: (...a: unknown[]) => reorderItem(...a),
    setItemStatus: (...a: unknown[]) => setItemStatus(...a),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const card = { id: 'card-1', stage_id: 'e1', pipeline_stage_id: 'e1', position: 10 } as unknown as PipelineItem;
const stages = [
  { id: 'e1', name: 'Novo', position: 1, stage_type: 'active', items: [card] },
  { id: 'e2', name: 'Contato', position: 2, stage_type: 'active', items: [] },
  { id: 'fu', name: 'Follow-up Automático', position: 3, stage_type: 'followup', items: [] },
] as unknown as PipelineStage[];

// Evento mínimo: a coluna sem cards embaixo do cursor (cai no topo).
const evento = () => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  clientY: 0,
  currentTarget: { querySelectorAll: () => [] },
}) as unknown as DragEvent;

const setStages = vi.fn();
const aoSoltarNoFollowup = vi.fn();

const montar = () => renderHook(() => useBoardDrag({
  pipelineId: 'funil-1',
  stages,
  setStages,
  mensagemDeErro: 'erro',
  podeArrastar: () => true,
  aoSoltarNoFollowup,
}));

const soltarEm = (result: ReturnType<typeof montar>['result'], stageId: string) => {
  act(() => result.current.handleDragStart(card, 80));
  act(() => result.current.handleDragOver(evento(), stageId));
  act(() => result.current.handleDrop(evento()));
};

beforeEach(() => {
  [reorderItem, setItemStatus, setStages, aoSoltarNoFollowup].forEach(m => m.mockReset());
  reorderItem.mockResolvedValue({});
});

describe('useBoardDrag — coluna Follow-up', () => {
  it('soltar na coluna Follow-up abre a janela e não chama reorder', () => {
    const { result } = montar();
    soltarEm(result, 'fu');

    expect(aoSoltarNoFollowup).toHaveBeenCalledTimes(1);
    expect(aoSoltarNoFollowup.mock.calls[0][0]).toMatchObject({ id: 'card-1' });
    expect(reorderItem).not.toHaveBeenCalled();
    expect(setStages).not.toHaveBeenCalled();
    // O esqueleto some na hora: o card não vai pro destino enquanto a janela pergunta.
    expect(result.current.alvo).toBeNull();
  });

  it('cancelar devolve o card', () => {
    const { result } = montar();
    soltarEm(result, 'fu');

    const terminar = aoSoltarNoFollowup.mock.calls[0][1] as () => void;
    act(() => terminar());

    // O card nunca saiu da coluna de origem: nada no quadro mudou e nada foi pro servidor.
    expect(setStages).not.toHaveBeenCalled();
    expect(reorderItem).not.toHaveBeenCalled();
    expect(result.current.arraste).toBeNull();
    expect(result.current.alvo).toBeNull();
  });

  it('outra coluna continua movendo pelo reorder', () => {
    const { result } = montar();
    soltarEm(result, 'e2');

    expect(aoSoltarNoFollowup).not.toHaveBeenCalled();
    expect(setStages).toHaveBeenCalled();
    expect(reorderItem).toHaveBeenCalledWith('funil-1', 'card-1', expect.objectContaining({ new_stage_id: 'e2' }));
  });
});
