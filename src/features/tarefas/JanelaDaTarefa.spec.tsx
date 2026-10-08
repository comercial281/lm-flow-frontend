import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const criar = vi.fn();
const editar = vi.fn();
const gestor = vi.hoisted(() => ({ valor: false }));
vi.mock('./useEhGestor', () => ({ useEhGestor: () => gestor.valor }));
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return { ...real, tarefasService: { criar: (...a: unknown[]) => criar(...a), editar: (...a: unknown[]) => editar(...a) } };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [{ id: 'l1', name: 'Carla', phone_number: '11999990000', in_pipeline: true }], meta: {} }) } }));
const lista = vi.hoisted(() => ({ opcoes: [] as unknown[] }));
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: async () => lista.opcoes } }));
const op = (id: string, label: string, position: number, active = true) => ({ id, list_key: 'task_categories', label, position, active, meta_exclusion: false });
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import JanelaDaTarefa from './JanelaDaTarefa';

beforeEach(() => { lista.opcoes = [op('cat-fu', 'Follow-up', 0), op('cat-of', 'Oferta ativa', 1), op('cat-velha', 'Velha', 2, false)]; criar.mockReset(); editar.mockReset(); toastError.mockReset(); gestor.valor = false; });

describe('JanelaDaTarefa', () => {
  it('cria no card com categoria, data e hora', async () => {
    criar.mockResolvedValue({ kind: 'task', id: 't1' });
    const aoSalvar = vi.fn();
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={aoSalvar} pipelineItemId="c1" />);
    await screen.findByRole('option', { name: 'Oferta ativa' });
    fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(criar).toHaveBeenCalled());
    const dados = criar.mock.calls[0][0];
    expect(dados).toMatchObject({ pipeline_item_id: 'c1', title: 'Ligar', category_option_id: 'cat-fu' });
    expect(new Date(dados.due_date).getHours()).toBe(10);
    expect(aoSalvar).toHaveBeenCalled();
  });

  it('sem título não chama o servidor', async () => {
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByText('Escreva o que é pra fazer.')).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  it('lead sem card mostra o aviso certo', async () => {
    criar.mockRejectedValue({ response: { data: { error: { details: { motivo: 'lead_sem_card' } } } } });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('ainda não está no funil')));
  });

  const existente = { kind: 'task', id: 't9', title: 'Ligar', description: 'algo', category: 'Follow-up', due_at: '2026-10-09T13:00:00.000Z', status: 'pending', overdue: false, pipeline_item_id: 'c1', pipeline_id: 'p1', contact: null, assignee: { id: 'u1', name: 'Ana' }, created_by_id: 'u1', can_edit: true, can_delete: true } as never;

  it('corretor não vê o Responsável', async () => {
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    await screen.findByLabelText('O que fazer');
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
  });

  it('gestor escolhe o Responsável e ele vai pro servidor', async () => {
    gestor.valor = true;
    criar.mockResolvedValue({ id: 't1' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    fireEvent.change(await screen.findByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.change(await screen.findByLabelText('Responsável'), { target: { value: 'u2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0]).toMatchObject({ assigned_to_id: 'u2' });
  });

  it('editar com o Responsável em branco mantém o atual (não manda assigned_to_id)', async () => {
    gestor.valor = true;
    editar.mockResolvedValue({ id: 't9' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
    expect(await screen.findByRole('option', { name: /Manter o responsável atual \(Ana\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(editar).toHaveBeenCalled());
    expect(editar.mock.calls[0][1]).not.toHaveProperty('assigned_to_id');
  });

  it('hora em branco é erro, como a data', async () => {
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByText('Escolha a hora.')).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  it('apagar os Detalhes ao editar manda texto vazio pro servidor limpar', async () => {
    editar.mockResolvedValue({ id: 't9' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={existente} />);
    fireEvent.change(screen.getByLabelText('Detalhes (opcional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(editar).toHaveBeenCalled());
    expect(editar.mock.calls[0][1].description).toBe('');
  });

  it('criar sem Detalhes não manda o campo', async () => {
    criar.mockResolvedValue({ id: 't1' });
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
    fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(criar.mock.calls[0][0].description).toBeUndefined();
  });

  it('na escolha de lead mostra o telefone e o link pra mudar diz "Trocar"', async () => {
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} escolherLead />);
    const linha = await screen.findByText('11999990000');
    fireEvent.click(linha);
    expect(await screen.findByRole('button', { name: 'Trocar' })).toBeInTheDocument();
  });

  describe('categoria da lista', () => {
    const comCategoria = (extra: Record<string, unknown>) => ({ ...(existente as object), ...extra }) as never;

    it('o seletor mostra só as ativas, na ordem', async () => {
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
      await screen.findByRole('option', { name: 'Oferta ativa' });
      const nomes = within(screen.getByLabelText('Categoria')).getAllByRole('option').map(o => o.textContent);
      expect(nomes).toEqual(['Follow-up', 'Oferta ativa']);
    });

    it('manda o id da categoria escolhida', async () => {
      criar.mockResolvedValue({ id: 't1' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
      await screen.findByRole('option', { name: 'Oferta ativa' });
      fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-of' } });
      fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
      fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0].category_option_id).toBe('cat-of');
      expect(criar.mock.calls[0][0]).not.toHaveProperty('category');
    });

    it('categoriaInicial (id) vale quando ainda está ativa; arquivada cai na primeira ativa', async () => {
      const { unmount } = render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" categoriaInicial="cat-of" />);
      await screen.findByRole('option', { name: 'Oferta ativa' });
      expect(screen.getByLabelText('Categoria')).toHaveValue('cat-of');
      unmount();
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" categoriaInicial="cat-velha" />);
      await screen.findByRole('option', { name: 'Oferta ativa' });
      expect(screen.getByLabelText('Categoria')).toHaveValue('cat-fu');
    });

    it('sem nenhuma categoria ativa: "Sem categoria" e a tarefa sai sem categoria', async () => {
      lista.opcoes = [op('cat-velha', 'Velha', 0, false)];
      criar.mockResolvedValue({ id: 't1' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
      expect(await screen.findByRole('option', { name: 'Sem categoria' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
      fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(criar.mock.calls[0][0]).not.toHaveProperty('category_option_id');
    });

    it('tarefa com categoria arquivada: aparece "(arquivada)" e, sem mexer, não manda o id', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Velha', category_option_id: 'cat-velha' })} />);
      expect(await screen.findByRole('option', { name: 'Velha (arquivada)' })).toBeInTheDocument();
      expect(screen.getByLabelText('Categoria')).toHaveValue('cat-velha');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category_option_id');
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category');
    });

    it('tarefa antiga só com nome: mostra o nome e não manda categoria se não mexer', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Nome solto', category_option_id: null })} />);
      expect(await screen.findByRole('option', { name: 'Nome solto' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1]).not.toHaveProperty('category_option_id');
    });

    it('editar e escolher outra categoria manda o id novo', async () => {
      editar.mockResolvedValue({ id: 't9' });
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} tarefa={comCategoria({ category: 'Velha', category_option_id: 'cat-velha' })} />);
      await screen.findByRole('option', { name: 'Velha (arquivada)' });
      fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-of' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(editar).toHaveBeenCalled());
      expect(editar.mock.calls[0][1].category_option_id).toBe('cat-of');
    });

    it('enquanto as categorias carregam, o botão fica desligado; depois liga', async () => {
      render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={() => {}} pipelineItemId="c1" />);
      expect(screen.getByRole('button', { name: 'Criar tarefa' })).toBeDisabled();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Criar tarefa' })).toBeEnabled());
    });
  });
});
