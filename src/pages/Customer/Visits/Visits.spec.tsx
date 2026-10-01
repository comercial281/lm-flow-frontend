import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return { ...real, useFeature: () => true };
});

const list = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      list: (...a: unknown[]) => list(...a),
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
