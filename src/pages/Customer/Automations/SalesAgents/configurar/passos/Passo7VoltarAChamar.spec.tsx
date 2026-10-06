import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

vi.mock('../../configuracao/legado/FollowupSection', () => ({
  FollowupPipelinesRow: () => <p>quais leads</p>,
  FollowupHoursRow: () => <p>quando pode sair</p>,
  FollowupActionPicker: () => <p>o que ela faz</p>,
}));

import Passo7VoltarAChamar from './Passo7VoltarAChamar';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Passo7VoltarAChamar agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

describe('Passo 7 · Voltar a chamar', () => {
  it('ligar a retomada manda só ela', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Retomar a pergunta antes do follow-up'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { reengagement_enabled: true });
  });

  it('follow-up sem limite de tentativas avisa', () => {
    abrir(agenteDeTeste({ followup_max_attempts: 0 }));
    expect(screen.getByText(/Sem limite de tentativas/)).toBeTruthy();
  });

  it('a linha do tempo mostra o que acontece', () => {
    abrir(agenteDeTeste({ reengagement_enabled: true, reengagement_first_hours: 1, reengagement_second_hours: 8 }));
    expect(screen.getByText('1h sem resposta: 1ª retomada')).toBeTruthy();
    expect(screen.getByText('Follow-up a cada 2 a 3 dias, até 3 vezes')).toBeTruthy();
  });

  it('desligado: some o resto', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Ir atrás de quem sumiu'));
    expect(screen.queryByText('o que ela faz')).toBeNull();
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { followup_enabled: false });
  });
});
