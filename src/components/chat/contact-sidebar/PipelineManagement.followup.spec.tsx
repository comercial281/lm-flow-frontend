import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PipelineManagement from './PipelineManagement';
import type { Pipeline } from '@/types/analytics';

// Fase 2 do follow-up (20/10/2026): mudar a etapa do lead pra coluna Follow-up
// abre a janela "Colocar em follow-up" em vez de mover.

const moveItem = vi.fn();
const getPipelines = vi.fn();
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    moveItem: (...a: unknown[]) => moveItem(...a),
    addItemToPipeline: vi.fn(),
    removeItemFromPipeline: vi.fn(),
    getPipelines: (...a: unknown[]) => getPipelines(...a),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const abrirFollowup = vi.fn();
vi.mock('@/features/followup/useColocarEmFollowup', () => ({
  useColocarEmFollowup: () => ({ abrir: (...a: unknown[]) => abrirFollowup(...a), janela: null }),
}));

// Seletor vira <select> nativo: 1º = funil, 2º = etapa.
vi.mock('@evoapi/design-system/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select value={value} onChange={e => onValueChange(e.target.value)}>
      <option value="">—</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

const funil = {
  id: 'funil-1',
  name: 'Funil de vendas',
  stages: [
    {
      id: 'e1', name: 'Novo', position: 0, stage_type: 'active',
      items: [{ id: 'card-1', item_id: 'conv-1', type: 'conversation', pipeline_id: 'funil-1', stage_id: 'e1' }],
    },
    { id: 'fu', name: 'Follow-up Automático', position: 1, stage_type: 'followup', items: [] },
  ],
} as unknown as Pipeline;

beforeEach(() => {
  [moveItem, getPipelines, abrirFollowup].forEach(m => m.mockReset());
  getPipelines.mockResolvedValue({ data: [funil] });
});

describe('PipelineManagement — coluna Follow-up', () => {
  it('salvar na coluna Follow-up abre a janela com o card e não move', async () => {
    const onPipelineUpdated = vi.fn();
    render(<PipelineManagement conversationId="conv-1" pipelines={[funil]} onPipelineUpdated={onPipelineUpdated} />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Follow-up Automático' })).toBeInTheDocument());
    const etapa = screen.getAllByRole('combobox')[1];
    fireEvent.change(etapa, { target: { value: 'fu' } });
    fireEvent.click(screen.getByRole('button', { name: /contactSidebar.pipeline.save/ }));

    await waitFor(() => expect(abrirFollowup).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineItemId: 'card-1', conversationId: 'conv-1' }),
      expect.objectContaining({ aoConfirmar: expect.any(Function), aoCancelar: expect.any(Function) }),
    ));
    expect(moveItem).not.toHaveBeenCalled();

    // Cancelar: a etapa volta pra atual.
    act(() => abrirFollowup.mock.calls[0][1].aoCancelar());
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('e1');

    // Iniciar: quem abriu recarrega.
    await act(async () => { await abrirFollowup.mock.calls[0][1].aoConfirmar({ started: true }); });
    expect(onPipelineUpdated).toHaveBeenCalled();
  });
});
