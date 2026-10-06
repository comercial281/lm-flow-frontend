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

vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: { list: vi.fn().mockResolvedValue({ data: [{ id: 'p1', code: 'ALMA', title: 'Residencial Exemplo' }] }) },
}));

import Passo5Vende from './Passo5Vende';

const abrir = (agent: SalesAgent = agenteDeTeste()) => {
  render(<MemoryRouter><Passo5Vende agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);
};

describe('Passo 5 · O que ela vende', () => {
  // Os encaixes do roteiro (perguntas de situação) saíram da tela e não podem sumir.
  it('tipo de venda grava no roteiro sem apagar os encaixes', async () => {
    abrir();
    await userEvent.selectOptions(screen.getByLabelText('Tipo de venda'), 'loteamento');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'], tipo_venda: 'loteamento' } } });
  });

  it('imóvel padrão escolhido na lista', async () => {
    abrir();
    await waitFor(() => expect(screen.getByRole('option', { name: 'ALMA · Residencial Exemplo' })).toBeTruthy());
    await userEvent.selectOptions(screen.getByLabelText('Imóvel padrão'), 'ALMA');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { default_property_code: 'ALMA' });
  });

  it('fotos e vídeo desmarcado', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Mandar fotos e vídeo do imóvel'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { rich_media_enabled: false });
  });
});
