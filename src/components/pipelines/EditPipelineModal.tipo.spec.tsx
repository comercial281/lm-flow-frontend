// Editar funil: o tipo dos funis de imóvel (Venda/Locação) aparece e é mantido ao salvar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pipeline } from '@/types/analytics';
import EditPipelineModal from './EditPipelineModal';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string) => chave }),
}));
vi.mock('@/services/teams/teamsService', () => ({
  default: { getTeams: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('./PipelineCustomAttributes', () => ({ default: () => null }));

const funil = (tipo: string) =>
  ({
    id: 'p1',
    name: 'Funil de teste',
    description: '',
    pipeline_type: tipo,
    visibility: 'public',
    is_active: true,
    team_ids: [],
  }) as unknown as Pipeline;

const abrir = (tipo: string) => {
  const onSubmit = vi.fn();
  render(
    <EditPipelineModal open onOpenChange={() => {}} pipeline={funil(tipo)} onSubmit={onSubmit} loading={false} />,
  );
  return { onSubmit };
};

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('EditPipelineModal: tipo do funil', () => {
  it("funil de venda mostra 'Venda' no tipo", () => {
    abrir('sale');
    expect(screen.getByRole('combobox', { name: 'editPipeline.pipelineType' })).toHaveTextContent('editPipeline.types.sale');
  });

  it("funil de locação mostra 'Locação'", () => {
    abrir('rental');
    expect(screen.getByRole('combobox', { name: 'editPipeline.pipelineType' })).toHaveTextContent('editPipeline.types.rental');
  });

  it('salvar sem mexer manda o tipo de hoje', async () => {
    const { onSubmit } = abrir('sale');
    await userEvent.click(screen.getByRole('button', { name: 'editPipeline.save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ pipeline_type: 'sale' }));
  });
});
