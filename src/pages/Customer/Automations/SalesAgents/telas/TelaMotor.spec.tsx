import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update, testPrompt: vi.fn().mockResolvedValue({ prompt: 'TEXTO' }) } };
});
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const equipe = vi.hoisted(() => ({ sim: true }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => equipe.sim }));
const roteiro = vi.hoisted(() => ({ sim: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: () => roteiro.sim }));
vi.mock('@/components/salesAgents/PlaybookSection', () => ({ default: () => <p>reescrever roteiro</p> }));

import TelaMotor from './TelaMotor';
import { esquecerSalvos } from '../configurar/useGravarNaHora';

beforeEach(() => {
  update.mockReset().mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste({ ...patch, updated_at: '2026-10-06T12:00:00Z' }));
  esquecerSalvos();
  equipe.sim = true;
  roteiro.sim = false;
});

describe('Motor', () => {
  it('equipe: muda o ritmo na hora (ao sair do campo), sem Salvar', async () => {
    render(<><TelaMotor agent={agenteDeTeste()} aoSalvo={vi.fn()} /><button>fora</button></>);
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    const espera = screen.getByLabelText('Espera antes de responder (segundos)');
    await userEvent.clear(espera);
    await userEvent.type(espera, '20');
    await userEvent.click(screen.getByText('fora'));
    expect(update).toHaveBeenCalledWith('ia-1', { reply_delay_seconds: 20 });
  });

  it('limite por dia grava só a subchave (o limite em dinheiro fica intacto)', async () => {
    render(<><TelaMotor agent={agenteDeTeste({ usage_limits: { daily_budget_usd: 5 } })} aoSalvo={vi.fn()} /><button>fora</button></>);
    await userEvent.type(screen.getByLabelText('Conversas novas por dia'), '30');
    await userEvent.click(screen.getByText('fora'));
    expect(update).toHaveBeenCalledWith('ia-1', { usage_limits: { daily_budget_usd: 5, max_new_leads_per_day: 30 } });
  });

  it('cliente com ia_playbook: só o texto que a IA recebe e a reescrita do roteiro', () => {
    equipe.sim = false;
    roteiro.sim = true;
    render(<TelaMotor agent={agenteDeTeste()} aoSalvo={vi.fn()} />);
    expect(screen.queryByLabelText('Espera antes de responder (segundos)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver o texto que a IA recebe' })).toBeInTheDocument();
    expect(screen.getByText('reescrever roteiro')).toBeInTheDocument();
  });
});
