/**
 * "Agendar visita" com a chave `agenda_do_corretor`: os horários vêm do
 * servidor (`/visits/availability`), dia fechado não se escolhe e a folga do
 * corretor aparece riscada. Com a chave desligada (ou o servidor dizendo
 * `enabled: false`) é a grade fixa de hoje — o resto do modal está em
 * ScheduleVisitDialog.spec.tsx, que roda sem a chave.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const ligadas = new Set<string>();
vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return {
    ...real,
    useFeature: () => true,
    useClientToggle: (k: string) => ligadas.has(k),
  };
});

const leadPickerPage = vi.fn();
const list = vi.fn();
const create = vi.fn();
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
      realtors: (...a: unknown[]) => realtors(...a),
    },
  };
});

const getSettings = vi.fn();
const listTimeOffs = vi.fn();
const availability = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    listTimeOffs: (...a: unknown[]) => listTimeOffs(...a),
    availability: (...a: unknown[]) => availability(...a),
  },
}));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));

import { ScheduleVisitDialog } from './ScheduleVisitDialog';
import { diaISO } from '@/features/visits/daySlots';

const LEAD = { id: 'c1', name: 'Leonardo Teste', phone_number: '5511999990000', in_pipeline: true, stage_name: null, owner: { id: 'u-bruno', name: 'Bruno' } };
const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

const hoje = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const maisDias = (n: number) => { const d = hoje(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
const amanha = () => maisDias(1);
const as = (dia: Date, h: number, m = 0) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m).toISOString();

const abrir = (diaInicial: Date = amanha()) =>
  render(<ScheduleVisitDialog open onOpenChange={vi.fn()} diaInicial={diaInicial} onCreated={vi.fn()} />);

const responderComo = (meta: { only_mine: boolean; me: { id: string; name: string } | null }) => {
  leadPickerPage.mockImplementation((_q: string, page: number, perPage: number) => {
    if (perPage === 1) return Promise.resolve({ data: [], meta });
    return Promise.resolve({ data: [LEAD], meta: { ...meta, total: 1, page, per_page: perPage, has_more: false } });
  });
};
const comoCorretor = () => responderComo({ only_mine: true, me: { id: 'u-ana', name: 'Ana' } });
const comoGestor = () => responderComo({ only_mine: false, me: null });

const settings = (p: Partial<{ days: number[]; closed_dates: string[] }> = {}) => ({
  enabled: true, days: TODOS_OS_DIAS, start: '08:00', end: '20:00', closed_dates: [], seeded_from: {}, ...p,
});
const diaAberto = (slots: unknown[]) => ({ enabled: true, day: { open: true, reason: null, reason_text: null }, slots });
const livre = (dia: Date, h: number, m = 0) => ({ at: as(dia, h, m), label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, state: 'free', client_name: null });

beforeEach(() => {
  vi.clearAllMocks();
  ligadas.clear();
  list.mockResolvedValue({ data: [], meta: { total: 0 } });
  realtors.mockResolvedValue([{ id: 'u-bruno', name: 'Bruno' }, { id: 'u-carla', name: 'Carla' }]);
  getSettings.mockResolvedValue(settings());
  listTimeOffs.mockResolvedValue([]);
  availability.mockResolvedValue(diaAberto([]));
});

describe('Agendar visita · chave da agenda desligada', () => {
  it('é a grade fixa de hoje e não pergunta nada à agenda', async () => {
    comoCorretor();
    abrir();

    expect(await screen.findByRole('button', { name: '07:00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '21:00' })).toBeEnabled();
    expect(getSettings).not.toHaveBeenCalled();
    expect(listTimeOffs).not.toHaveBeenCalled();
    expect(availability).not.toHaveBeenCalled();
  });
});

describe('Agendar visita · chave da agenda ligada', () => {
  beforeEach(() => { ligadas.add('agenda_do_corretor'); });

  it('os horários vêm do servidor: ocupado e folga riscados, nada fora do horário de visita', async () => {
    comoCorretor();
    const d = amanha();
    availability.mockResolvedValue(diaAberto([
      livre(d, 8),
      { at: as(d, 15), label: '15:00', state: 'busy', client_name: 'Fulano Teste' },
      { at: as(d, 16), label: '16:00', state: 'time_off', client_name: null },
      livre(d, 19),
    ]));
    abrir();

    const ocupado = await screen.findByRole('button', { name: '15:00 · ocupado, Fulano Teste' });
    expect(ocupado).toBeDisabled();
    expect(ocupado.textContent).toBe('15:00');
    expect(ocupado).toHaveClass('line-through');

    const folga = screen.getByRole('button', { name: '16:00 · folga' });
    expect(folga).toBeDisabled();
    expect(folga.textContent).toBe('16:00');
    expect(folga).toHaveClass('line-through');

    expect(screen.getByRole('button', { name: '08:00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '19:00' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '07:00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '21:00' })).not.toBeInTheDocument();

    expect(availability).toHaveBeenLastCalledWith({ realtor_id: 'u-ana', date: diaISO(d), duration: 60 });
  });

  it('trocar a duração pede de novo, e a resposta velha não pisa na nova', async () => {
    comoCorretor();
    const d = amanha();
    let soltarVelha: (v: unknown) => void = () => {};
    availability.mockImplementation(({ duration, realtor_id }: { duration: number; realtor_id?: string }) => {
      if (duration === 60 && realtor_id === 'u-ana') return new Promise(r => { soltarVelha = r; });
      if (duration === 90) return Promise.resolve(diaAberto([livre(d, 10)]));
      return new Promise(() => {});
    });
    abrir();

    await waitFor(() => expect(availability).toHaveBeenCalledWith({ realtor_id: 'u-ana', date: diaISO(d), duration: 60 }));
    await userEvent.click(screen.getByRole('button', { name: '1h30' }));
    expect(await screen.findByRole('button', { name: '10:00' })).toBeEnabled();

    soltarVelha(diaAberto([livre(d, 9)]));
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: '09:00' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10:00' })).toBeInTheDocument();
  });

  it('servidor com a agenda desligada (enabled: false): volta para a grade fixa', async () => {
    comoCorretor();
    availability.mockResolvedValue({ enabled: false });
    getSettings.mockResolvedValue({ enabled: false });
    abrir();

    expect(await screen.findByRole('button', { name: '07:00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '21:00' })).toBeEnabled();
  });

  it('atalho de dia fechado fica desabilitado com o motivo (data fechada, folga de dia inteiro)', async () => {
    comoCorretor();
    getSettings.mockResolvedValue(settings({ closed_dates: [diaISO(hoje())] }));
    listTimeOffs.mockResolvedValue([
      { id: 't1', user_id: 'u-ana', user_name: 'Ana', starts_on: diaISO(amanha()), ends_on: diaISO(amanha()), start_time: null, end_time: null, note: null },
    ]);
    abrir(maisDias(10));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Amanhã' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Amanhã' })).toHaveAttribute('title', 'Ana está de folga nesse dia');
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('title', 'Essa data está fechada para visitas');
    expect(screen.getByRole('button', { name: 'Sábado' })).toBeEnabled();
    expect(listTimeOffs).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-ana' }));
  });

  it('dia da semana sem visita desabilita o atalho com o nome do dia', async () => {
    comoCorretor();
    getSettings.mockResolvedValue(settings({ days: [0, 1, 2, 3, 4, 5] }));
    abrir(maisDias(10));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sábado' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Sábado' })).toHaveAttribute('title', 'Sábado não tem visita');
  });

  it('outra data fechada: o campo leva o motivo e no lugar dos horários vem a frase do servidor', async () => {
    comoCorretor();
    const d = maisDias(10);
    getSettings.mockResolvedValue(settings({ closed_dates: [diaISO(d)] }));
    availability.mockResolvedValue({
      enabled: true,
      day: { open: false, reason: 'closed_date', reason_text: 'Essa data está fechada para visitas' },
      slots: [],
    });
    abrir(d);

    expect(await screen.findByText('Essa data está fechada para visitas')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Outra data')).toHaveAttribute('title', 'Essa data está fechada para visitas'));
    expect(screen.getByLabelText('Outra data')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument();
  });

  it('gestor sem corretor escolhido: pede o horário de visita sem corretor, e as folgas só depois de escolher', async () => {
    comoGestor();
    const d = amanha();
    availability.mockResolvedValue(diaAberto([livre(d, 10)]));
    abrir();

    expect(await screen.findByRole('button', { name: '10:00' })).toBeEnabled();
    expect(availability).toHaveBeenCalledWith({ realtor_id: undefined, date: diaISO(d), duration: 60 });
    expect(listTimeOffs).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Carla' }));
    await waitFor(() => expect(availability).toHaveBeenLastCalledWith({ realtor_id: 'u-carla', date: diaISO(d), duration: 60 }));
    await waitFor(() => expect(listTimeOffs).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-carla' })));
  });

  it('422 ao agendar pede os horários do dia de novo', async () => {
    comoCorretor();
    const d = amanha();
    availability.mockResolvedValue(diaAberto([livre(d, 10)]));
    create.mockRejectedValue({ response: { status: 422, data: { error: { message: 'Ana já tem visita com Fulano Teste das 10h às 11h' } } } });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    const antes = availability.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Ana já tem visita com Fulano Teste das 10h às 11h'));
    await waitFor(() => expect(availability.mock.calls.length).toBeGreaterThan(antes));
  });

  it('o horário escolhido que deixou de estar livre é limpo', async () => {
    comoCorretor();
    const d = amanha();
    availability.mockResolvedValueOnce(diaAberto([livre(d, 10)]));
    availability.mockResolvedValue(diaAberto([{ at: as(d, 10), label: '10:00', state: 'busy', client_name: 'Fulano Teste' }]));
    create.mockRejectedValue({ response: { status: 422, data: { error: { message: 'Ocupado' } } } });
    abrir();

    await userEvent.click(await screen.findByPlaceholderText('Buscar cliente por nome ou telefone'));
    await userEvent.click(await screen.findByText('Leonardo Teste'));
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    expect(screen.getByText(/das 10h às 11h/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));

    expect(await screen.findByRole('button', { name: '10:00 · ocupado, Fulano Teste' })).toBeDisabled();
    expect(screen.queryByText(/das 10h às 11h/)).not.toBeInTheDocument();
  });
});
