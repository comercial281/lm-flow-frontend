// "Novo card" não oferece a coluna Follow-up (Fase 4, 22/10/2026): lead entra
// em follow-up pelo "Colocar em follow-up", que escolhe qual follow-up roda.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pipelinesService } from '@/services/pipelines';
import type { PipelineStage } from '@/types/analytics';
import AddItemModal from './AddItemModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string) => chave }),
}));
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getAvailableConversations: vi.fn(),
    getAvailableContacts: vi.fn(),
    addItemToPipeline: vi.fn(),
    moveItem: vi.fn(),
  },
}));
vi.mock('@/services/contacts', () => ({
  contactsService: { createContact: vi.fn(), updateContact: vi.fn(), searchContacts: vi.fn(), getContactPipelines: vi.fn() },
}));

const etapa = (id: string, name: string, stage_type: string, position: number) =>
  ({ id, name, color: '#3B82F6', position, stage_type }) as unknown as PipelineStage;
const NOVO = etapa('s1', 'Novo', 'active', 1);
const FOLLOW = etapa('s2', 'Em follow-up', 'followup', 2);
const FECHADO = etapa('s3', 'Fechado', 'completed', 3);

const abrir = (stages: PipelineStage[], preselectedStage?: PipelineStage | null) =>
  render(
    <AddItemModal open onOpenChange={() => {}} pipelineId="p1" stages={stages} preselectedStage={preselectedStage} onItemAdded={vi.fn()} />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  vi.mocked(pipelinesService.getAvailableConversations).mockResolvedValue([
    { id: 'conv-1', contact: { id: 'k1', name: 'Maria Souza' } },
  ] as never);
  vi.mocked(pipelinesService.addItemToPipeline).mockResolvedValue({} as never);
});

describe('Novo card · coluna Follow-up', () => {
  it('o Novo card não oferece a coluna Follow-up', async () => {
    abrir([NOVO, FOLLOW, FECHADO]);
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    expect(await screen.findByRole('option', { name: 'Novo' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Fechado' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Em follow-up' })).toBeNull();
  });

  it('funil com a coluna Follow-up primeiro: nasce na primeira comum', async () => {
    abrir([FOLLOW, NOVO]);
    await userEvent.click(await screen.findByText('Maria Souza'));
    await userEvent.click(screen.getByRole('button', { name: 'addItem.add' }));
    await waitFor(() => expect(pipelinesService.addItemToPipeline).toHaveBeenCalled());
    expect(vi.mocked(pipelinesService.addItemToPipeline).mock.calls[0][1]).toMatchObject({ pipeline_stage_id: 's1' });
  });

  it('etapa pré-selecionada do tipo Follow-up é ignorada', async () => {
    abrir([NOVO, FOLLOW], FOLLOW);
    await userEvent.click(await screen.findByText('Maria Souza'));
    await userEvent.click(screen.getByRole('button', { name: 'addItem.add' }));
    await waitFor(() => expect(pipelinesService.addItemToPipeline).toHaveBeenCalled());
    expect(vi.mocked(pipelinesService.addItemToPipeline).mock.calls[0][1]).toMatchObject({ pipeline_stage_id: 's1' });
  });

  it('funil só com coluna Follow-up: nada pré-selecionado, não envia', async () => {
    abrir([FOLLOW]);
    await userEvent.click(await screen.findByText('Maria Souza'));
    const botao = screen.getByRole('button', { name: 'addItem.add' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(pipelinesService.addItemToPipeline).not.toHaveBeenCalled();
  });
});
