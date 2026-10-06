import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

const agenda = { ligada: false };
vi.mock('@/features/visits/useAgendaLigada', () => ({ useAgendaLigada: () => agenda }));

import Passo4Visita from './Passo4Visita';

const abrir = (agent: SalesAgent = agenteDeTeste(), irParaPasso = vi.fn()) => {
  render(<MemoryRouter><Passo4Visita agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={irParaPasso} /></MemoryRouter>);
  return irParaPasso;
};

describe('Passo 4 · Visita', () => {
  it('só qualifica: não tem visita, leva pro Objetivo', async () => {
    const ir = abrir(agenteDeTeste({ reach: 'qualify' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mudar em Objetivo' }));
    expect(ir).toHaveBeenCalledWith(2);
  });

  it('duração e regra do mesmo dia, sem perder as datas bloqueadas guardadas', async () => {
    abrir(agenteDeTeste({ visit_config: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30, blocked_dates: ['2026-12-25'], avoid_double_booking: true, same_day_requires_human: true } }));
    await userEvent.clear(screen.getByLabelText('Duração da visita (minutos)'));
    await userEvent.type(screen.getByLabelText('Duração da visita (minutos)'), '90');
    await userEvent.click(screen.getByLabelText('Visita para hoje só com o corretor confirmando'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      visit_duration_minutes: 90,
      visit_config: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30, blocked_dates: ['2026-12-25'], avoid_double_booking: true, same_day_requires_human: false },
    });
  });

  it('horário próprio: sábado entra', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Um horário próprio'));
    await userEvent.click(screen.getByRole('button', { name: 'Sáb' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { visit_config: expect.objectContaining({ days: [1, 2, 3, 4, 5, 6] }) });
  });

  it('com a Agenda ligada, o horário vem de lá', () => {
    agenda.ligada = true;
    abrir();
    expect(screen.getAllByText(/vêm da Agenda de Visitas/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Um horário próprio')).toBeNull();
    agenda.ligada = false;
  });
});
