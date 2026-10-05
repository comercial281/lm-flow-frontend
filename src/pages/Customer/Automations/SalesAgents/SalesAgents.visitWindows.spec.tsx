import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return { ...real, useFeature: () => true, useClientToggle: () => false };
});

// A agenda ligada ou não é o que o servidor responde em `GET /visit_settings`.
const getSettings = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: { getSettings: (...a: unknown[]) => getSettings(...a) },
}));
const LIGADA = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: [], seeded_from: {} };

import { VisitWindows } from './configuracao/legado/VisitWindows';
import { esquecerAgendaLigada } from '@/features/visits/useAgendaLigada';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

const CONFIG = { days: [1, 2, 3], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30, blocked_dates: ['2026-12-25'] };
const agente = { id: 'ia-1', visit_config: CONFIG } as unknown as SalesAgent;

const abrir = (onSave = vi.fn()) => {
  render(<MemoryRouter><VisitWindows agent={agente} onSave={onSave} /></MemoryRouter>);
  return onSave;
};

beforeEach(() => {
  vi.clearAllMocks();
  esquecerAgendaLigada();
  getSettings.mockResolvedValue({ enabled: false });
});

const camposDeSempre = () => {
  expect(screen.getByRole('button', { name: 'Seg' })).toBeInTheDocument();
  expect(screen.getByLabelText('Das')).toHaveValue('09:00');
  expect(screen.getByLabelText('até')).toHaveValue('18:00');
  expect(screen.getByText(/Datas bloqueadas no calendário/)).toBeInTheDocument();
  expect(screen.getByText('2026-12-25')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
};

describe('IA · Quando a IA pode marcar visita', () => {
  it('servidor com a agenda desligada (`enabled: false`): dias, faixa e datas bloqueadas, como sempre', async () => {
    abrir();
    camposDeSempre();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    camposDeSempre();
  });

  it('403 ou erro no horário de visita: os campos de sempre', async () => {
    getSettings.mockRejectedValue(new Error('403'));
    abrir();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    camposDeSempre();
  });

  it('agenda ligada no servidor: some dia, faixa e datas bloqueadas; aparece o link para a Agenda', async () => {
    getSettings.mockResolvedValue(LIGADA);
    abrir();

    expect(await screen.findByText(/Usa o horário de visita da Agenda/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seg' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Das')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('até')).not.toBeInTheDocument();
    expect(screen.queryByText(/Datas bloqueadas no calendário/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bloquear data/ })).not.toBeInTheDocument();

    expect(screen.getByText(/Usa o horário de visita da Agenda/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /editar/i })).toHaveAttribute('href', '/visits');

    expect(screen.getByLabelText('Antecedência mín. (horas)')).toBeInTheDocument();
    expect(screen.getByLabelText('máx. (dias)')).toBeInTheDocument();
    expect(screen.getByText('Visita para hoje só com o corretor confirmando')).toBeInTheDocument();
    expect(screen.getByText('Evitar dois leads no mesmo horário')).toBeInTheDocument();
  });

  it('agenda ligada no servidor: mudar a antecedência grava sem mexer nos dias e horário guardados', async () => {
    getSettings.mockResolvedValue(LIGADA);
    const onSave = abrir();
    await screen.findByText(/Usa o horário de visita da Agenda/);

    fireEvent.change(screen.getByLabelText('Antecedência mín. (horas)'), { target: { value: '12' } });

    expect(onSave).toHaveBeenCalledWith({ visit_config: { ...CONFIG, min_advance_hours: 12 } });
  });
});
