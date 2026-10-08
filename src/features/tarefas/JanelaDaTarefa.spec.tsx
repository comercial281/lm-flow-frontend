import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const criar = vi.fn();
vi.mock('./tarefasService', async () => {
  const real = await vi.importActual<typeof import('./tarefasService')>('./tarefasService');
  return { ...real, tarefasService: { criar: (...a: unknown[]) => criar(...a), editar: vi.fn() } };
});
vi.mock('@/services/visits/visitsService', () => ({ visitsService: { realtors: async () => [{ id: 'u2', name: 'Bruno' }], leadPickerPage: async () => ({ data: [], meta: {} }) } }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import JanelaDaTarefa from './JanelaDaTarefa';

beforeEach(() => { criar.mockReset(); toastError.mockReset(); });

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
});
