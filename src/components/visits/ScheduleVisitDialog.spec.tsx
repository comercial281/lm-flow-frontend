import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const leadPickerPage = vi.fn();
const leadPicker = vi.fn();
const list = vi.fn();
const create = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      leadPickerPage: (...a: unknown[]) => leadPickerPage(...a),
      leadPicker: (...a: unknown[]) => leadPicker(...a),
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
    },
  };
});
vi.mock('@/services/users', () => ({ usersService: { getUsers: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));

import { ScheduleVisitDialog } from './ScheduleVisitDialog';

const LEAD = { id: 'c1', name: 'Leonardo Teste', phone_number: '5511999990000', in_pipeline: true, stage_name: 'Em atendimento', owner: { id: 'u-bruno', name: 'Bruno' } };
const LEAD_SEM_DONO = { id: 'c2', name: 'Marcos Teste', phone_number: '5511999992222', in_pipeline: false, stage_name: null, owner: null };

// Amanhã: a lista de horários começa às 07:00, sem depender da hora do teste.
const amanha = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); };

const abrir = () =>
  render(<ScheduleVisitDialog open onOpenChange={vi.fn()} diaInicial={amanha()} onCreated={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  leadPicker.mockResolvedValue([LEAD]);
  list.mockResolvedValue({ data: [], meta: { total: 0 } });
});

describe('Agendar visita', () => {
  it('corretor: o responsável é ele, sem campo de busca', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u-ana', name: 'Ana' } } });
    abrir();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar corretor por nome')).not.toBeInTheDocument();
    expect(screen.queryByText('Criar contato novo')).not.toBeInTheDocument();
  });

  it('gestor: escolher o cliente preenche o corretor com o dono do lead', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: false, me: null } });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));

    expect(await screen.findByDisplayValue('Bruno')).toBeInTheDocument();
  });

  it('horário ocupado aparece riscado e não pode ser escolhido', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u-ana', name: 'Ana' } } });
    const d = amanha();
    list.mockResolvedValue({
      data: [{ id: 'v1', scheduled_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 15, 0).toISOString(), duration_minutes: 60, status: 'scheduled', contact: { name: 'Fulano Teste' } }],
      meta: { total: 1 },
    });
    abrir();

    const ocupado = await screen.findByRole('button', { name: /15:00 · ocupado, Fulano Teste/ });
    expect(ocupado).toBeDisabled();
    expect(screen.getByRole('button', { name: '16:00' })).toBeEnabled();
  });

  it('mostra o motivo que o servidor deu', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u-ana', name: 'Ana' } } });
    create.mockRejectedValue({ response: { data: { error: { message: 'Você já tem visita com Fulano Teste das 15h às 16h' } } } });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Você já tem visita com Fulano Teste das 15h às 16h'));
  });

  it('corretor não manda realtor_id; observações vão como realtor_notes', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u-ana', name: 'Ana' } } });
    create.mockResolvedValue({ id: 'v9' });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    await userEvent.type(screen.getByPlaceholderText('Detalhes da visita'), 'Levar a chave');
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0][0];
    expect(payload.realtor_id).toBeUndefined();
    expect(payload.realtor_notes).toBe('Levar a chave');
    expect(payload.duration_minutes).toBe(60);
  });

  it('gestor: o payload manda o dono do lead como realtor_id', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: false, me: null } });
    create.mockResolvedValue({ id: 'v10' });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].realtor_id).toBe('u-bruno');
  });

  it('gestor: trocar para um cliente sem dono limpa o corretor e barra o salvar', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: false, me: null } });
    leadPicker.mockResolvedValue([LEAD, LEAD_SEM_DONO]);
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    expect(await screen.findByDisplayValue('Bruno')).toBeInTheDocument();

    await userEvent.click(screen.getByDisplayValue(/Leonardo Teste/));
    await userEvent.click(await screen.findByText('Marcos Teste'));

    expect(screen.queryByDisplayValue('Bruno')).not.toBeInTheDocument();
    expect((screen.getByPlaceholderText('Buscar corretor por nome') as HTMLInputElement).value).toBe('');

    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Escolha o corretor responsável'));
    expect(create).not.toHaveBeenCalled();
  });

  it('corretor travado: sem outra visita mostra o texto na 1ª pessoa', async () => {
    leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u-ana', name: 'Ana' } } });
    abrir();

    expect(await screen.findByText('Nenhuma outra visita sua nesse dia.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma outra visita de/)).not.toBeInTheDocument();
  });
});
