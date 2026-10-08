// src/pages/Customer/Tarefas/Tarefas.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const listar = vi.fn();
const concluir = vi.fn();
// A janela de verdade tem teste próprio: aqui só interessa com que dados abre.
vi.mock('@/features/tarefas/JanelaDaTarefa', () => ({
  default: (p: { aberta: boolean; pipelineItemId?: string | null; categoriaInicial?: string; escolherLead?: boolean }) =>
    p.aberta ? <div data-testid="janela">{`card=${p.pipelineItemId ?? ''};cat=${p.categoriaInicial ?? ''};lead=${String(!!p.escolherLead)}`}</div> : null,
}));
vi.mock('@/services/listOptions/listOptionsService', () => ({
  listOptionsService: { list: async () => [{ id: 'cat-fu', list_key: 'task_categories', label: 'Follow-up', position: 0, active: true, meta_exclusion: false }, { id: 'cat-of', list_key: 'task_categories', label: 'Oferta ativa', position: 1, active: true, meta_exclusion: false }, { id: 'cat-v', list_key: 'task_categories', label: 'Velha', position: 2, active: false, meta_exclusion: false }] },
}));
vi.mock('@/features/tarefas/tarefasService', async () => {
  const real = await vi.importActual<typeof import('@/features/tarefas/tarefasService')>('@/features/tarefas/tarefasService');
  return { ...real, tarefasService: { listar: (...a: unknown[]) => listar(...a), concluir: (...a: unknown[]) => concluir(...a) } };
});
vi.mock('@/services/visits/visitsService', async () => ({ ...(await vi.importActual<object>('@/services/visits/visitsService')), visitsService: { realtors: async () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [], meta: {} }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Tarefas from './Tarefas';

const resposta = (data: unknown[], onlyMine = false) => ({
  data,
  meta: { counts: { para_fazer: 3, hoje: 2, amanha: 0, atrasadas: 1, semana: 2, proxima_semana: 0, concluidas: 40 }, total: data.length, page: 1, per_page: 30, only_mine: onlyMine },
});

beforeEach(() => {
  listar.mockReset();
  concluir.mockReset();
});

describe('Tarefas', () => {
  it('abre em Vence hoje, só tarefas, com as contagens nas abas', async () => {
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: { id: 'x', name: 'Carla' }, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
    ]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    expect(await screen.findByText('Ligar')).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'hoje', kind: 'task' }));
    expect(screen.getByRole('heading', { name: 'Tarefas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vence hoje \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concluídas \(40\)/ })).toBeInTheDocument();
  });

  it('trocar de aba pede o balde novo', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Atrasadas/ }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: 'atrasadas' })));
  });

  it('corretor (lista só dele) não vê o filtro de pessoa', async () => {
    listar.mockResolvedValue(resposta([], true));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByLabelText('Pessoa')).not.toBeInTheDocument();
  });

  it('trocar de aba estando na página 2 pede uma vez só, na página 1', async () => {
    const muitas = { ...resposta([]), meta: { ...resposta([]).meta, total: 100 } };
    listar.mockResolvedValue(muitas);
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    listar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Atrasadas/ }));
    await waitFor(() => expect(listar).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 50));
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'atrasadas', page: 1 }));
  });

  it('resposta lenta que chega depois da nova não sobrescreve a tela', async () => {
    const tarefa = (id: string, title: string) => ({ kind: 'task', id, title, due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: null, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true });
    let soltarPrimeira: (v: unknown) => void = () => {};
    listar.mockImplementationOnce(() => new Promise(r => { soltarPrimeira = r; }));
    listar.mockResolvedValueOnce(resposta([tarefa('t2', 'Segunda')]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Atrasadas/ }));
    expect(await screen.findByText('Segunda')).toBeInTheDocument();
    soltarPrimeira(resposta([tarefa('t1', 'Primeira')]));
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText('Primeira')).not.toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
  });

  it('concluir pergunta pela próxima e abre a janela no card da tarefa concluída', async () => {
    concluir.mockResolvedValue({});
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', category: 'Oferta ativa', category_option_id: 'cat-of', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'card-9', pipeline_id: 'p1', contact: { id: 'x', name: 'Carla' }, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
    ]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir ligar/i }));
    await waitFor(() => expect(concluir).toHaveBeenCalledWith('t1'));
    await screen.findByText('Criar a próxima tarefa deste lead?');
    fireEvent.click(await screen.findByRole('button', { name: 'Nova tarefa' }));
    expect(await screen.findByTestId('janela')).toHaveTextContent('card=card-9;cat=cat-of;lead=false');
  });

  it('o filtro de categoria lista só as ativas e manda category_option_id', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    await screen.findByRole('option', { name: 'Oferta ativa' });
    expect(screen.queryByRole('option', { name: 'Velha' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-of' } });
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ category_option_id: 'cat-of' })));
    expect(listar.mock.calls.at(-1)?.[0]).not.toHaveProperty('category');
  });

  it('"Agora não" na pergunta da próxima não abre janela', async () => {
    concluir.mockResolvedValue({});
    listar.mockResolvedValue(resposta([
      { kind: 'task', id: 't1', title: 'Ligar', due_at: new Date().toISOString(), status: 'pending', overdue: false, pipeline_item_id: 'card-9', pipeline_id: 'p1', contact: null, assignee: null, created_by_id: 'u1', can_edit: true, can_delete: true },
    ]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /concluir ligar/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByTestId('janela')).not.toBeInTheDocument();
  });

  it('é só de tarefas: sem filtro de tipo nem "Agendar visita"', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    await screen.findByText('Nada pra hoje.');
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar visita' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova tarefa' })).toBeInTheDocument();
  });

  it('todo pedido leva kind task, também ao trocar de aba', async () => {
    listar.mockResolvedValue(resposta([]));
    render(<MemoryRouter><Tarefas /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Atrasadas/ }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: 'atrasadas', kind: 'task' })));
  });
});
