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

vi.mock('../../configuracao/legado/TriggersSection', () => ({ TriggersSection: () => <p>regras de entrada</p> }));

import Passo6Atendimento from './Passo6Atendimento';

const abrir = (agent: SalesAgent = agenteDeTeste(), irParaPasso = vi.fn()) => {
  render(<MemoryRouter><Passo6Atendimento agent={agent} inboxes={[{ id: 'inbox-1', name: 'Número de teste' }]} aoSalvo={vi.fn()} irParaPasso={irParaPasso} /></MemoryRouter>);
  return irParaPasso;
};

describe('Passo 6 · Atendimento', () => {
  // O "call" esquecido do checklist §6: a palavra antiga restringe calada.
  it('a palavra antiga aparece e sai com um clique', async () => {
    abrir(agenteDeTeste({ trigger_keyword: 'call' }));
    expect(screen.getByText(/só entra quando o lead escreve "call"/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar essa regra' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { trigger_keyword: null });
  });

  it('só fora do horário comercial, avisando quem escrever', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Só fora do horário comercial (18:00 às 07:00)'));
    await userEvent.click(screen.getByLabelText('Avisar quem escrever fora do horário'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { active_hours: { mode: 'outside_business', tz: 'America/Sao_Paulo' }, out_of_hours_reply: true });
  });

  it('voltar pra todos os leads limpa as regras', async () => {
    abrir(agenteDeTeste({ triggers: [{ type: 'keyword', value: 'call' }] }));
    expect(screen.getByText('regras de entrada')).toBeTruthy();
    expect(screen.getByText(/quem escrever "call"/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Todos os leads do número'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { triggers: [] });
  });

  it('a prévia resume o atendimento e o rodapé leva ao Avançado', async () => {
    const ir = abrir();
    expect(screen.getByText('Atende todos os leads do Número de teste, 24h.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Avançado' }));
    expect(ir).toHaveBeenCalledWith('avancado');
  });
});
