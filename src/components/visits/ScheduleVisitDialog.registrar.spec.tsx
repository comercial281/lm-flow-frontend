/**
 * "Agendar visita" nos dois modos da frente 4 de Visitas: registrar a visita que
 * já aconteceu (dia que passou, ou horário de hoje que passou com "Sim, já
 * aconteceu") e remarcar uma visita (`visitaParaRemarcar`). O agendar de sempre
 * está em ScheduleVisitDialog.spec.tsx e ScheduleVisitDialog.agenda.spec.tsx.
 * Spec: specs/2026-10-10-visitas-frente-4-design.md (pasta LM FLOW).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const leadPickerPage = vi.fn();
const list = vi.fn();
const create = vi.fn();
const reschedule = vi.fn();
const realtors = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      leadPickerPage: (...a: unknown[]) => leadPickerPage(...a),
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
      reschedule: (...a: unknown[]) => reschedule(...a),
      realtors: (...a: unknown[]) => realtors(...a),
    },
  };
});
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: { getSettings: vi.fn().mockResolvedValue({ enabled: false }) },
}));
// Agenda desligada: a grade fixa de daySlots.ts.
vi.mock('@/features/visits/useAgendaLigada', () => ({
  useAgendaLigada: () => ({ ligada: false, ajustes: null }),
}));

import { ScheduleVisitDialog } from './ScheduleVisitDialog';
import type { Visit } from '@/services/visits/visitsService';

// O seletor de clientes vem vazio: o cliente chega pelo `leadInicial` (o card do lead).
const LEAD = { id: 'c1', name: 'Marcos Teste', phone_number: null, in_pipeline: true, stage_name: null, owner: { id: 'u1', name: 'Ana' } };

const VISITA: Visit = {
  id: 'v1',
  property_id: 'p1',
  contact_id: 'c9',
  realtor_id: 'u1',
  status: 'scheduled',
  // Amanhã (11/10) às 10:00.
  scheduled_at: new Date(2026, 9, 11, 10, 0).toISOString(),
  duration_minutes: 60,
  property: { id: 'p1', title: 'Apartamento Centro', code: 'AP01' },
  contact: { id: 'c9', name: 'Leonardo' },
  realtor: { id: 'u1', name: 'Ana' },
  created_at: new Date(2026, 9, 1).toISOString(),
  updated_at: new Date(2026, 9, 1).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Hoje é sexta, 10/10/2026, 11:10: de 07:00 a 11:00 já passou.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 11, 10));
  list.mockResolvedValue({ data: [] });
  leadPickerPage.mockResolvedValue({ data: [], meta: { only_mine: true, me: { id: 'u1', name: 'Ana' } } });
  realtors.mockResolvedValue([]);
  create.mockResolvedValue({ id: 'nova' });
  reschedule.mockResolvedValue({ id: 'v1' });
});

afterEach(() => {
  vi.useRealTimers();
});

const abrir = (props: Partial<Parameters<typeof ScheduleVisitDialog>[0]> = {}) =>
  render(<ScheduleVisitDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} leadInicial={LEAD} {...props} />);

const clicar = async (nome: string) => userEvent.click(await screen.findByRole('button', { name: nome }));

describe('Agendar visita · registrar a que já aconteceu', () => {
  it('dia que passou abre em "Registrar visita realizada", com retorno e a grade até 22:00', async () => {
    const onCreated = vi.fn();
    abrir({ diaInicial: new Date(2026, 9, 8), onCreated });

    expect(await screen.findByRole('heading', { name: 'Registrar visita realizada' })).toBeInTheDocument();
    expect(screen.getByText('Retorno (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '22:00' })).toBeEnabled();
    // Registro não pergunta nada: o dia todo já passou.
    expect(screen.queryByText('Essa visita já aconteceu?')).not.toBeInTheDocument();

    await clicar('14:00');
    await userEvent.click(screen.getByRole('button', { name: 'Avaliar com 4 estrelas' }));
    await userEvent.type(screen.getByPlaceholderText('Como foi a visita? Interesse do cliente?'), 'Gostou');
    await clicar('Registrar visita');

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      contact_id: 'c1',
      status: 'completed',
      scheduled_at: new Date(2026, 9, 8, 14, 0).toISOString(),
      rating: 4,
      feedback_notes: 'Gostou',
    }));
    expect(reschedule).not.toHaveBeenCalled();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'nova' }));
  });

  it('hoje mostra "Já passou"; horário que passou com "Sim, já aconteceu" registra', async () => {
    abrir();

    expect(await screen.findByText('Já passou')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Agendar visita' })).toBeInTheDocument();

    await clicar('08:00');
    expect(screen.getByText('Essa visita já aconteceu?')).toBeInTheDocument();

    await clicar('Sim, já aconteceu');
    expect(screen.getByRole('heading', { name: 'Registrar visita realizada' })).toBeInTheDocument();
    expect(screen.getByText('Retorno (opcional)')).toBeInTheDocument();

    await clicar('Registrar visita');

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      scheduled_at: new Date(2026, 9, 10, 8, 0).toISOString(),
    }));
  });

  it('hoje, "Não, ainda vai acontecer" agenda normal, sem situação', async () => {
    abrir();

    await clicar('08:00');
    await clicar('Não, ainda vai acontecer');
    expect(screen.getByRole('heading', { name: 'Agendar visita' })).toBeInTheDocument();
    await clicar('Agendar');

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const payload = create.mock.calls[0][0];
    expect(payload).not.toHaveProperty('status');
    expect(payload.scheduled_at).toBe(new Date(2026, 9, 10, 8, 0).toISOString());
  });

  it('hoje, horário que passou sem responder a pergunta não salva e avisa', async () => {
    abrir();

    await clicar('08:00');
    await clicar('Agendar');

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Diga se a visita já aconteceu'));
    expect(create).not.toHaveBeenCalled();
  });

  it('trocar de horário passado para um futuro some com a pergunta', async () => {
    abrir();

    await clicar('08:00');
    await clicar('Sim, já aconteceu');
    await clicar('14:00');

    expect(screen.queryByText('Essa visita já aconteceu?')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agendar visita' })).toBeInTheDocument();
  });

  it('o imóvel inicial já vem escolhido e vai no salvar', async () => {
    abrir({ diaInicial: new Date(2026, 9, 11), imovelInicial: { id: 'p7', title: 'Casa Jardim', code: 'CA07' } });

    expect(await screen.findByText('CA07 escolhido')).toBeInTheDocument();
    await clicar('15:00');
    await clicar('Agendar');

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ property_id: 'p7' })));
  });
});

describe('Agendar visita · remarcar', () => {
  it('cliente e imóvel fixos, só horários futuros, salva com reschedule', async () => {
    const onCreated = vi.fn();
    abrir({ leadInicial: null, visitaParaRemarcar: VISITA, onCreated });

    expect(await screen.findByRole('heading', { name: 'Remarcar visita' })).toBeInTheDocument();
    expect(screen.getByText('Escolha o novo dia e horário')).toBeInTheDocument();
    expect(screen.getByText('Leonardo')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar cliente por nome ou telefone')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar por título ou código')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Detalhes da visita')).not.toBeInTheDocument();
    expect(screen.getByText(/AP01/)).toBeInTheDocument();
    expect(screen.queryByText('Já passou')).not.toBeInTheDocument();

    await clicar('15:00');
    await clicar('Remarcar');

    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
    expect(reschedule).toHaveBeenCalledWith('v1', new Date(2026, 9, 11, 15, 0).toISOString(), { duration_minutes: 60 });
    expect(reschedule.mock.calls[0][2].realtor_id).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'v1' }));
  });

  it('remarcar no dia de hoje não mostra "Já passou"', async () => {
    abrir({ leadInicial: null, visitaParaRemarcar: { ...VISITA, scheduled_at: new Date(2026, 9, 10, 16, 0).toISOString() } });

    expect(await screen.findByRole('heading', { name: 'Remarcar visita' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '11:30' })).toBeInTheDocument();
    expect(screen.queryByText('Já passou')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '08:00' })).not.toBeInTheDocument();
  });
});
