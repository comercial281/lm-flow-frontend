import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listAll = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/superAdmin/superAgentsService', () => ({
  superAgentsService: { listAll, update, inboxes: vi.fn().mockResolvedValue([]), models: vi.fn().mockResolvedValue([]) },
  MODE_LABELS: { seller: 'Vendedor(a)' },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SuperAgents from './SuperAgents';

const sara = { id: 'a1', tenant_slug: 'alfa', tenant_name: 'Imobiliária Alfa', name: 'Sara', enabled: true, mode: 'seller', updated_at: '' };
const bia = { id: 'a2', tenant_slug: 'beta', tenant_name: 'Imobiliária Beta', name: 'Bia', enabled: false, mode: 'seller', updated_at: '' };

describe('IA Vendedora → Agentes', () => {
  beforeEach(() => { listAll.mockReset(); update.mockReset(); });

  it('erro ao carregar aparece como erro com tentar de novo, nunca como "nenhuma IA"', async () => {
    listAll.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([sara]);
    const user = userEvent.setup();
    render(<SuperAgents />);
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Sara')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma IA Vendedora nos clientes')).not.toBeInTheDocument();
  });

  it('sem IA nenhuma: vazio', async () => {
    listAll.mockResolvedValue([]);
    render(<SuperAgents />);
    expect(await screen.findByText('Nenhuma IA Vendedora nos clientes')).toBeInTheDocument();
  });

  it('busca por cliente; sem resultado oferece limpar', async () => {
    listAll.mockResolvedValue([sara, bia]);
    const user = userEvent.setup();
    render(<SuperAgents />);
    const busca = await screen.findByRole('searchbox', { name: 'Buscar cliente' });
    await user.type(busca, 'beta');
    expect(screen.queryByText('Sara')).not.toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
    await user.clear(busca);
    await user.type(busca, 'zzz');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });

  it('desligar confirma com o nome do cliente e só grava depois do ok', async () => {
    listAll.mockResolvedValue([sara]);
    update.mockResolvedValue({ ...sara, enabled: false });
    const user = userEvent.setup();
    render(<SuperAgents />);
    const chave = await screen.findByRole('switch', { name: 'IA Sara de Imobiliária Alfa' });
    await user.click(chave);
    expect(await screen.findByText('A IA de Imobiliária Alfa para de responder os leads.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(chave).toBeChecked());
    expect(update).not.toHaveBeenCalled();

    await user.click(chave);
    await user.click(await screen.findByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', 'alfa', { enabled: false }));
  });

  it('ligar não pede confirmação', async () => {
    listAll.mockResolvedValue([bia]);
    update.mockResolvedValue({ ...bia, enabled: true });
    const user = userEvent.setup();
    render(<SuperAgents />);
    await user.click(await screen.findByRole('switch', { name: 'IA Bia de Imobiliária Beta' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a2', 'beta', { enabled: true }));
    expect(screen.queryByText(/para de responder os leads/)).not.toBeInTheDocument();
  });
});
