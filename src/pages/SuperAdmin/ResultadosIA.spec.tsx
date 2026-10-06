import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const performance = vi.hoisted(() => vi.fn());
vi.mock('@/services/superAdmin/superAgentsService', () => ({ superAgentsService: { performance } }));
vi.mock('@/components/salesAgents/AiResultsPanel', () => ({ default: ({ caption }: { caption: string }) => <p>{caption}</p> }));

import ResultadosIA from './ResultadosIA';

const tenant = { tenant_slug: 'alfa', tenant_name: 'Imobiliária Alfa', ai_leads: 12, reply_rate: 0.5, visits: 2, series: [] };
const relatorio = (tenants: unknown[] = [tenant]) =>
  ({ days: 30, since: '', generated_at: '', totals: { clients: tenants.length, ai_leads: 12, reply_rate: 0.5, visits: 2 }, tenants, series: [] });

const montar = () => render(<MemoryRouter><ResultadosIA /></MemoryRouter>);

describe('IA Vendedora → Dashboard', () => {
  beforeEach(() => performance.mockReset());

  it('período nas abas da casa: trocar pede o período novo', async () => {
    performance.mockResolvedValue(relatorio());
    const user = userEvent.setup();
    montar();
    expect(await screen.findByText('Leads atendidos pela IA em todos os clientes')).toBeInTheDocument();
    expect(performance).toHaveBeenCalledWith(30);
    await user.click(screen.getByRole('tab', { name: '7 dias' }));
    await waitFor(() => expect(performance).toHaveBeenLastCalledWith(7));
    expect(screen.getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'true');
  });

  it('erro aparece como erro com tentar de novo, nunca como "nenhuma IA com movimento"', async () => {
    performance.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(relatorio());
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Leads atendidos pela IA em todos os clientes')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma IA com movimento no período')).not.toBeInTheDocument();
  });

  it('sem movimento: vazio', async () => {
    performance.mockResolvedValue(relatorio([]));
    montar();
    expect(await screen.findByText('Nenhuma IA com movimento no período')).toBeInTheDocument();
  });

  it('continua sem custo na tela (nada de R$, US$ ou token)', async () => {
    performance.mockResolvedValue(relatorio());
    montar();
    await screen.findByText('2 visitas pela IA');
    expect(screen.queryByText(/R\$|US\$|token/i)).not.toBeInTheDocument();
  });
});
