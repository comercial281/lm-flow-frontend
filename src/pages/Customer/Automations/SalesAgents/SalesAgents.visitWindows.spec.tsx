import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

import { VisitWindows } from './SalesAgents';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

const CONFIG = { days: [1, 2, 3], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30, blocked_dates: ['2026-12-25'] };
const agente = { id: 'ia-1', visit_config: CONFIG } as unknown as SalesAgent;

const abrir = (onSave = vi.fn()) => {
  render(<MemoryRouter><VisitWindows agent={agente} onSave={onSave} /></MemoryRouter>);
  return onSave;
};

beforeEach(() => { ligadas.clear(); });

describe('IA · Quando a IA pode marcar visita', () => {
  it('chave da agenda desligada: dias, faixa e datas bloqueadas, como sempre', () => {
    abrir();

    expect(screen.getByRole('button', { name: 'Seg' })).toBeInTheDocument();
    expect(screen.getByLabelText('Das')).toHaveValue('09:00');
    expect(screen.getByLabelText('até')).toHaveValue('18:00');
    expect(screen.getByText(/Datas bloqueadas no calendário/)).toBeInTheDocument();
    expect(screen.getByText('2026-12-25')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('chave da agenda ligada: some dia, faixa e datas bloqueadas; aparece o link para a Agenda', () => {
    ligadas.add('agenda_do_corretor');
    abrir();

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

  it('chave ligada: mudar a antecedência grava sem mexer nos dias e horário guardados', () => {
    ligadas.add('agenda_do_corretor');
    const onSave = abrir();

    fireEvent.change(screen.getByLabelText('Antecedência mín. (horas)'), { target: { value: '12' } });

    expect(onSave).toHaveBeenCalledWith({ visit_config: { ...CONFIG, min_advance_hours: 12 } });
  });
});
