import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return { ...real, useFeature: () => true };
});

const list = vi.fn();
const cancel = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      list: (...a: unknown[]) => list(...a),
      cancel: (...a: unknown[]) => cancel(...a),
      realtors: vi.fn().mockResolvedValue([]),
      leadPickerPage: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    },
  };
});

const getSettings = vi.fn();
const listTimeOffs = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    listTimeOffs: (...a: unknown[]) => listTimeOffs(...a),
  },
}));

import Visits from './Visits';
import { esquecerAgendaLigada } from '@/features/visits/useAgendaLigada';

// A agenda ligada ou não é o que o servidor responde em `GET /visit_settings`.
const LIGADA = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} };

const abrir = () => render(<MemoryRouter><Visits /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  esquecerAgendaLigada();
  list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: false } });
  getSettings.mockResolvedValue(LIGADA);
  listTimeOffs.mockResolvedValue([]);
});

describe('Agenda de Visitas: botões da agenda do corretor', () => {
  it('servidor com a agenda desligada (`enabled: false`): nenhum botão novo', async () => {
    getSettings.mockResolvedValue({ enabled: false });
    abrir();
    expect(await screen.findByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Folgas/ })).toBeNull();
    expect(listTimeOffs).not.toHaveBeenCalled();
  });

  it('403 ou erro no horário de visita: nenhum botão novo', async () => {
    getSettings.mockRejectedValue(new Error('403'));
    abrir();
    expect(await screen.findByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Folgas/ })).toBeNull();
  });

  it('agenda ligada no servidor, gestor: Horário de visita e Folgas', async () => {
    const user = userEvent.setup();
    abrir();
    const horario = await screen.findByRole('button', { name: /Horário de visita/ });
    expect(screen.getByRole('button', { name: /^Folgas$/ })).toBeInTheDocument();
    await user.click(horario);
    expect(await screen.findByRole('heading', { name: 'Horário de visita' })).toBeInTheDocument();
  });

  it('agenda ligada no servidor, corretor: só Minhas folgas, sem Horário de visita', async () => {
    list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: true } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: /Minhas folgas/ }));
    expect(await screen.findByRole('heading', { name: 'Minhas folgas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
  });
});

describe('Agenda de Visitas: Semana e Dia', () => {
  beforeEach(() => {
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  it('Semana pede ao servidor só a semana e desenha a visita como bloco', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    list.mockResolvedValue({
      data: [{ id: 'v1', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } }],
      meta: { total: 1, active_total: 1, only_mine: false },
    });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Semana' }));

    const domingo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
    const sabado = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + 6);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ since: iso(domingo), until: iso(sabado) })));
    expect(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ })).toBeInTheDocument();
    expect(screen.getByText('1 visita nesta semana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar no dia da semana abre a visão Dia, e a escolha fica guardada', async () => {
    list.mockResolvedValue({ data: [], meta: { total: 0, active_total: 0, only_mine: false } });
    const user = userEvent.setup();
    const { unmount } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Semana' }));
    const hoje = new Date();
    await user.click(screen.getByRole('button', { name: `Ver o dia ${hoje.getDate()}` }));
    expect(screen.getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('0 visitas hoje')).toBeInTheDocument());
    unmount();

    abrir();
    expect(await screen.findByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Agenda de Visitas: clique na visita do calendário', () => {
  beforeEach(() => {
    try { localStorage.removeItem('lm-visitas-visao'); } catch { /* sem armazenamento */ }
  });

  it('visita agendada abre o resumo com Confirmar / Realizada / Cancelar, e dá para cancelar', async () => {
    const hoje = new Date();
    const as15 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 15, 0);
    const visita = { id: 'v1', status: 'scheduled', scheduled_at: as15.toISOString(), duration_minutes: 60, contact: { id: 'c1', name: 'Thyago' } };
    list.mockResolvedValue({ data: [visita], meta: { total: 1, active_total: 1, only_mine: false } });
    cancel.mockResolvedValue({ ...visita, status: 'cancelled' });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: /15:00–16:00 · Thyago/ }));

    const resumo = await screen.findByRole('dialog');
    expect(within(resumo).getByRole('button', { name: /Confirmar/ })).toBeInTheDocument();
    expect(within(resumo).getByRole('button', { name: /Realizada/ })).toBeInTheDocument();
    await user.click(within(resumo).getByRole('button', { name: /Cancelar/ }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Motivo do cancelamento')).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar visita' }));
    expect(cancel).toHaveBeenCalledWith('v1', undefined);
  });
});
