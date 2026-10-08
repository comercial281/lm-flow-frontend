import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listar = vi.fn();
const concluir = vi.fn();
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return { ...real, tarefasService: { listar: (...a: unknown[]) => listar(...a), concluir: (...a: unknown[]) => concluir(...a) } };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [], leadPickerPage: async () => ({ data: [], meta: {} }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TarefasDoLead from './TarefasDoLead';

const tarefa = (id: string, extra: Record<string, unknown> = {}) => ({
  kind: 'task', id, title: `Tarefa ${id}`, category: 'Follow-up', due_at: new Date().toISOString(), status: 'pending',
  overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: { id: 'ct', name: 'Carla' }, assignee: { id: 'u', name: 'Ana' },
  created_by_id: 'u', can_edit: true, can_delete: true, ...extra,
});
const resposta = (data: unknown[]) => ({ data, meta: { counts: {}, total: data.length, page: 1, per_page: 50, only_mine: true } });

beforeEach(() => { listar.mockReset(); concluir.mockReset(); });

describe('TarefasDoLead', () => {
  it('lista as abertas com a atrasada primeiro e conta pra aba', async () => {
    listar.mockImplementation(async (p: { bucket: string }) =>
      p.bucket === 'para_fazer' ? resposta([tarefa('a'), tarefa('b', { overdue: true })]) : resposta([]));
    const aoContar = vi.fn();
    render(<TarefasDoLead pipelineItemIds={['c1']} criarNoCard="c1" aoContar={aoContar} />);
    const itens = await screen.findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Tarefa b');
    expect(aoContar).toHaveBeenLastCalledWith({ abertas: 2, atrasadas: 1 });
  });

  it('concluir pergunta pela próxima tarefa', async () => {
    listar.mockImplementation(async (p: { bucket: string }) => (p.bucket === 'para_fazer' ? resposta([tarefa('a')]) : resposta([])));
    concluir.mockResolvedValue(tarefa('a', { status: 'completed' }));
    render(<TarefasDoLead pipelineItemIds={['c1']} criarNoCard="c1" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir tarefa a/i }));
    await waitFor(() => expect(concluir).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('Criar a próxima tarefa deste lead?')).toBeInTheDocument();
  });

  it('sem card pra criar, não mostra o botão Nova tarefa', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<TarefasDoLead pipelineItemIds={[]} criarNoCard={null} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument());
  });
});
