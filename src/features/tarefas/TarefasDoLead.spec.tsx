import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listar = vi.fn();
const concluir = vi.fn();
const criar = vi.fn();
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return { ...real, tarefasService: { listar: (...a: unknown[]) => listar(...a), concluir: (...a: unknown[]) => concluir(...a), criar: (...a: unknown[]) => criar(...a), contexto: async () => ({ pipeline_item_id: 'outro-card', pipeline_name: 'Funil', contact: null, owner: null }), agendaDoDia: async () => [] } };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [], leadPickerPage: async () => ({ data: [], meta: {} }) } }));
vi.mock('@/services/listOptions/listOptionsService', () => ({
  listOptionsService: { list: async () => [{ id: 'cat-fu', list_key: 'task_categories', label: 'Follow-up', position: 0, active: true, meta_exclusion: false }, { id: 'cat-of', list_key: 'task_categories', label: 'Oferta ativa', position: 1, active: true, meta_exclusion: false }] },
}));
vi.mock('./useEhGestor', () => ({ useEhGestor: () => false }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TarefasDoLead from './TarefasDoLead';

const tarefa = (id: string, extra: Record<string, unknown> = {}) => ({
  kind: 'task', id, title: `Tarefa ${id}`, category: 'Oferta ativa', category_option_id: 'cat-of', due_at: new Date().toISOString(), status: 'pending',
  overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: { id: 'ct', name: 'Carla' }, assignee: { id: 'u', name: 'Ana' },
  created_by_id: 'u', can_edit: true, can_delete: true, ...extra,
});
const resposta = (data: unknown[], total = data.length) => ({ data, meta: { counts: {}, total, page: 1, per_page: 50, only_mine: true } });

beforeEach(() => { listar.mockReset(); concluir.mockReset(); criar.mockReset(); });

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

  it('a próxima tarefa nasce no card e na categoria (por id) da tarefa concluída', async () => {
    listar.mockImplementation(async (p: { bucket: string }) => (p.bucket === 'para_fazer' ? resposta([tarefa('a', { pipeline_item_id: 'outro-card' })]) : resposta([])));
    concluir.mockResolvedValue(tarefa('a', { status: 'completed' }));
    criar.mockResolvedValue(tarefa('n'));
    render(<TarefasDoLead pipelineItemIds={['c1', 'outro-card']} criarNoCard="c1" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir tarefa a/i }));
    await screen.findByText('Criar a próxima tarefa deste lead?');
    fireEvent.click(await screen.findByRole('button', { name: 'Nova tarefa' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Oferta ativa' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.change(await screen.findByLabelText('Título da tarefa'), { target: { value: 'Seguir' } });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(salvar).toBeEnabled());
    fireEvent.click(salvar);
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0]).toMatchObject({ pipeline_item_id: 'outro-card', category_option_id: 'cat-of' });
  });

  it('"Concluídas (N)" usa o total do servidor, não o tamanho da página', async () => {
    listar.mockImplementation(async (p: { bucket: string }) => (p.bucket === 'concluidas' ? resposta([tarefa('x'), tarefa('y')], 57) : resposta([])));
    render(<TarefasDoLead pipelineItemIds={['c1']} criarNoCard="c1" />);
    expect(await screen.findByRole('button', { name: 'Concluídas (57)' })).toBeInTheDocument();
  });
});
