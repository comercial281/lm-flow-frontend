import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: (m: string) => toastSuccess(m) } }));

const listTimeOffs = vi.fn();
const createTimeOff = vi.fn();
const removeTimeOff = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: {
    listTimeOffs: (...a: unknown[]) => listTimeOffs(...a),
    createTimeOff: (...a: unknown[]) => createTimeOff(...a),
    removeTimeOff: (...a: unknown[]) => removeTimeOff(...a),
  },
}));

const realtors = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return { ...real, visitsService: { ...real.visitsService, realtors: (...a: unknown[]) => realtors(...a) } };
});

import { FolgasDialog } from './FolgasDialog';

const FOLGA_ANA = {
  id: 'f2', user_id: 'u-ana', user_name: 'Ana Teste', starts_on: '2026-10-20', ends_on: '2026-10-20',
  start_time: null, end_time: null, note: null,
};
const FOLGA_BRUNO = {
  id: 'f1', user_id: 'u-bruno', user_name: 'Bruno Teste', starts_on: '2026-10-07', ends_on: '2026-10-07',
  start_time: '14:00', end_time: '18:00', note: 'Médico',
};

const abrir = (soMinhas: boolean) => render(<FolgasDialog open onOpenChange={vi.fn()} soMinhas={soMinhas} />);

const preencherDatas = (inicio: string, fim: string) => {
  fireEvent.change(screen.getByLabelText('Começa em'), { target: { value: inicio } });
  fireEvent.change(screen.getByLabelText('Termina em'), { target: { value: fim } });
};

beforeEach(() => {
  vi.clearAllMocks();
  listTimeOffs.mockResolvedValue([FOLGA_ANA, FOLGA_BRUNO]);
  realtors.mockResolvedValue([{ id: 'u-ana', name: 'Ana Teste' }, { id: 'u-bruno', name: 'Bruno Teste' }]);
  createTimeOff.mockResolvedValue({ id: 'f3' });
  removeTimeOff.mockResolvedValue(undefined);
});

describe('Folgas', () => {
  it('lista as próximas primeiro, com o nome do corretor para o gestor', async () => {
    abrir(false);
    const itens = await screen.findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Bruno Teste');
    expect(itens[0]).toHaveTextContent('Quarta, 07/10, das 14h às 18h');
    expect(itens[0]).toHaveTextContent('Médico');
    expect(itens[1]).toHaveTextContent('Ana Teste');
    expect(itens[1]).toHaveTextContent('dia inteiro');
  });

  it('corretor não vê os botões de corretor e cria a folga sem escolher ninguém', async () => {
    const user = userEvent.setup();
    abrir(true);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('group', { name: 'De quem é a folga' })).toBeNull();
    expect(realtors).not.toHaveBeenCalled();

    preencherDatas('2026-10-07', '2026-10-07');
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));

    await waitFor(() => expect(createTimeOff).toHaveBeenCalledTimes(1));
    expect(createTimeOff.mock.calls[0][0]).not.toHaveProperty('user_id');
    expect(toastSuccess).toHaveBeenCalledWith('Folga criada');
  });

  it('gestor vê os botões de corretor e precisa escolher um', async () => {
    const user = userEvent.setup();
    abrir(false);
    const grupo = await screen.findByRole('group', { name: 'De quem é a folga' });
    expect(within(grupo).getByRole('button', { name: 'Ana Teste' })).toBeInTheDocument();

    preencherDatas('2026-10-07', '2026-10-07');
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha o corretor');
    expect(createTimeOff).not.toHaveBeenCalled();

    await user.click(within(grupo).getByRole('button', { name: 'Bruno Teste' }));
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));
    await waitFor(() => expect(createTimeOff).toHaveBeenCalledTimes(1));
    expect(createTimeOff.mock.calls[0][0]).toMatchObject({ user_id: 'u-bruno' });
  });

  it('dia inteiro manda os horários nulos', async () => {
    const user = userEvent.setup();
    abrir(true);
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('checkbox', { name: 'Dia inteiro' })).toBeChecked();

    preencherDatas('2026-10-07', '2026-10-09');
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'Viagem');
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));

    await waitFor(() => expect(createTimeOff).toHaveBeenCalledTimes(1));
    expect(createTimeOff).toHaveBeenCalledWith({
      starts_on: '2026-10-07', ends_on: '2026-10-09', start_time: null, end_time: null, note: 'Viagem',
    });
  });

  it('faixa de horas manda start_time e end_time, e avisa que vale em cada dia', async () => {
    const user = userEvent.setup();
    abrir(true);
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('checkbox', { name: 'Dia inteiro' }));
    expect(screen.getByText('A faixa vale em cada dia do período.')).toBeInTheDocument();
    expect(screen.getByLabelText('Das').tagName).toBe('SELECT');
    expect(document.querySelector('input[type="time"]')).toBeNull();

    preencherDatas('2026-10-07', '2026-10-07');
    await user.selectOptions(screen.getByLabelText('Das'), '14:00');
    await user.selectOptions(screen.getByLabelText('Até'), '18:00');
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));

    await waitFor(() => expect(createTimeOff).toHaveBeenCalledTimes(1));
    expect(createTimeOff).toHaveBeenCalledWith({
      starts_on: '2026-10-07', ends_on: '2026-10-07', start_time: '14:00', end_time: '18:00', note: null,
    });
  });

  it('erro 422 do servidor aparece na janela', async () => {
    createTimeOff.mockRejectedValue({
      response: { status: 422, data: { success: false, error: { code: 'invalid', message: 'O fim da folga precisa ser depois do início' } } },
    });
    const user = userEvent.setup();
    abrir(true);
    await screen.findAllByRole('listitem');
    preencherDatas('2026-10-07', '2026-10-07');
    await user.click(screen.getByRole('button', { name: 'Criar folga' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O fim da folga precisa ser depois do início');
  });

  it('Excluir pede confirmação antes', async () => {
    const user = userEvent.setup();
    abrir(true);
    const [primeira] = await screen.findAllByRole('listitem');

    await user.click(within(primeira).getByRole('button', { name: 'Excluir' }));
    expect(removeTimeOff).not.toHaveBeenCalled();
    await user.click(within(primeira).getByRole('button', { name: 'Sim, excluir' }));

    await waitFor(() => expect(removeTimeOff).toHaveBeenCalledWith('f1'));
    expect(listTimeOffs).toHaveBeenCalledTimes(2);
  });

  it('sem folga: diz que não há; erro ao carregar: oferece tentar de novo', async () => {
    listTimeOffs.mockResolvedValueOnce([]);
    const { unmount } = abrir(true);
    expect(await screen.findByText('Nenhuma folga marcada.')).toBeInTheDocument();
    unmount();

    listTimeOffs.mockRejectedValueOnce(new Error('rede'));
    abrir(true);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
