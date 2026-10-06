import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
const testPrompt = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a), testPrompt: (...a: unknown[]) => testPrompt(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const equipe = { sim: false };
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => equipe.sim }));
vi.mock('@/contexts/TenantFeaturesContext', async (orig) => {
  const real = await orig<typeof import('@/contexts/TenantFeaturesContext')>();
  return { ...real, useClientToggle: () => false };
});
vi.mock('@/components/salesAgents/PlaybookSection', () => ({ default: () => <p>blocos do roteiro</p> }));

import Avancado from './Avancado';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Avancado agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  equipe.sim = false;
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

describe('Avançado', () => {
  it('o gestor vê, mas não muda', () => {
    abrir();
    expect(screen.getByLabelText('Prioridade no número')).toBeDisabled();
    expect(screen.getByLabelText('Modelo de IA')).toBeDisabled();
    expect(screen.queryByText('blocos do roteiro')).toBeNull();
  });

  it('o gestor lê o texto que a IA recebe', async () => {
    testPrompt.mockResolvedValue({ prompt: 'Você é consultora da Aurora.' });
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ver o texto que a IA recebe' }));
    expect(await screen.findByText('Você é consultora da Aurora.')).toBeTruthy();
  });

  it('a equipe muda e salva só o que mexeu', async () => {
    equipe.sim = true;
    abrir();
    await userEvent.clear(screen.getByLabelText('Prioridade no número'));
    await userEvent.type(screen.getByLabelText('Prioridade no número'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith('ia-1', { priority: 5 });
    expect(screen.getByText('blocos do roteiro')).toBeTruthy();
  });

  it('limite por dia grava sem perder o limite em dinheiro guardado', async () => {
    equipe.sim = true;
    abrir(agenteDeTeste({ usage_limits: { daily_budget_usd: 5 } }));
    await userEvent.type(screen.getByLabelText('Conversas novas por dia'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith('ia-1', { usage_limits: { daily_budget_usd: 5, max_new_leads_per_day: 40 } });
  });
});
