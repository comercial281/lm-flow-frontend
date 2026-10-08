import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const criar = vi.fn();
const editar = vi.fn();
const gestor = vi.hoisted(() => ({ valor: false }));
vi.mock('./useEhGestor', () => ({ useEhGestor: () => gestor.valor }));
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return { ...real, tarefasService: { criar: (...a: unknown[]) => criar(...a), editar: (...a: unknown[]) => editar(...a) } };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [{ id: 'l1', name: 'Carla', phone_number: '11999990000', in_pipeline: true }], meta: {} }) } }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import JanelaDaTarefa from './JanelaDaTarefa';

beforeEach(() => { criar.mockReset(); editar.mockReset(); toastError.mockReset(); gestor.valor = false; });

describe('JanelaDaTarefa', () => {
  it('cria no card com categoria, data e hora', async () => {
    criar.mockResolvedValue({ kind: 'task', id: 't1' });
    const aoSalvar = vi.fn();
    render(<JanelaDaTarefa aberta aoFechar={() => {}} aoSalvar={aoSalvar} pipelineItemId="c1" />);
    fireEvent.change(screen.getByLabelText('O que fazer'), { target: { value: 'Ligar' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(criar).toHaveBeenCalled());
    const dados = criar.mock.calls[0][0];
    expect(dados).toMatchObject({ pipeline_item_id: 'c1', title: 'Ligar', category: 'Follow-up' });
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
});
