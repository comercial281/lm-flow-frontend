import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import EnsinarTextos from './EnsinarTextos';

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

describe('Ensinar · instruções, prova social e exemplos', () => {
  it('mostra as instruções de hoje e salva só o que mudou', async () => {
    render(<EnsinarTextos agent={agenteDeTeste()} aoSalvo={vi.fn()} />);
    expect(screen.getByLabelText('Instruções')).toHaveValue('Seja breve.');
    await userEvent.type(screen.getByLabelText('Prova social'), 'Família Souza fechou em 2 semanas.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith('ia-1', { social_proof: 'Família Souza fechou em 2 semanas.' });
  });

  it('exemplo de conversa: o lead disse / ela respondeu', async () => {
    render(<EnsinarTextos agent={agenteDeTeste()} aoSalvo={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar exemplo' }));
    await userEvent.type(screen.getByLabelText('O que o lead disse (exemplo 1)'), 'quero 2 quartos');
    await userEvent.type(screen.getByLabelText('Como respondeu (exemplo 1)'), 'boa! é pra morar?');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith('ia-1', { example_conversations: [{ lead: 'quero 2 quartos', resposta: 'boa! é pra morar?' }] });
  });
});
