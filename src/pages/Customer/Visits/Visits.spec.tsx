import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// A chave da agenda do corretor, ligada ou não, por teste.
const ligadas = new Set<string>();
vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return {
    ...real,
    useFeature: () => true,
    useClientToggle: (k: string) => ligadas.has(k),
  };
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

const abrir = () => render(<MemoryRouter><Visits /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  ligadas.clear();
  list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: false } });
  getSettings.mockResolvedValue({ enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} });
  listTimeOffs.mockResolvedValue([]);
});

describe('Agenda de Visitas: botões da agenda do corretor', () => {
  it('chave desligada: nenhum botão novo', async () => {
    abrir();
    expect(await screen.findByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Folgas/ })).toBeNull();
  });

  it('chave ligada, gestor: Horário de visita e Folgas', async () => {
    ligadas.add('agenda_do_corretor');
    const user = userEvent.setup();
    abrir();
    const horario = await screen.findByRole('button', { name: /Horário de visita/ });
    expect(screen.getByRole('button', { name: /^Folgas$/ })).toBeInTheDocument();
    await user.click(horario);
    expect(await screen.findByRole('heading', { name: 'Horário de visita' })).toBeInTheDocument();
  });

  it('chave ligada, corretor: só Minhas folgas, sem Horário de visita', async () => {
    ligadas.add('agenda_do_corretor');
    list.mockResolvedValue({ data: [], meta: { total: 0, only_mine: true } });
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: /Minhas folgas/ }));
    expect(await screen.findByRole('heading', { name: 'Minhas folgas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Horário de visita/ })).toBeNull();
  });
});
