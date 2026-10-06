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


import Passo8TestarLigar from './Passo8TestarLigar';

const abrir = (agent: SalesAgent, irParaPasso = vi.fn()) => {
  render(<MemoryRouter><Passo8TestarLigar agent={agent} inboxes={[{ id: 'inbox-1', name: 'Número de teste' }]} aoSalvo={vi.fn()} irParaPasso={irParaPasso} /></MemoryRouter>);
  return irParaPasso;
};
const pronta = (extra: Partial<SalesAgent> = {}) =>
  agenteDeTeste({ enabled: false, lead_facing_name: 'Dona do número', handoff_target: 'number_owner', handoff_user_id: null, ...extra });

describe('Passo 8 · Testar e ligar', () => {
  it('Ligar travado sem número, dizendo por quê', () => {
    abrir(pronta({ inbox_id: null }));
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getAllByText('Falta o número de WhatsApp.').length).toBeGreaterThan(0);
  });

  it('Ligar travado na persona corretor sem dono do número', () => {
    abrir(pronta({ number_owner_id: null }));
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('pronta: liga na hora, só o enabled', async () => {
    abrir(pronta());
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('ia-1', { enabled: true }));
  });

  it('resumo por passo com Editar', async () => {
    const ir = abrir(pronta());
    expect(screen.getByText('O próprio corretor · Dona do número')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Objetivo' }));
    expect(ir).toHaveBeenCalledWith(2);
  });
});
