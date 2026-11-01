import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

const resumos = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { resumos } }));
import PaginaDeAgentes from './PaginaDeAgentes';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

const ag = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({
    id, name, enabled: true, inbox_id: 'in-1', job: 'leva_visita', next_steps: ['visita'], house_voice: { kind: 'consultora' },
    serves: ['venda'], numbers: [{ id: 'n1', inbox_id: 'in-1', inbox_name: 'Canal', owner_name: 'Ana', voice: { kind: 'corretor' } }],
    catalog_marks: { venda: 5, locacao: 0, leilao: 0, empreendimento: 0 }, triggers: [], trigger_keyword: null, trigger_match_mode: 'any',
    ...extra,
  }) as unknown as SalesAgent;

function Endereco() {
  const l = useLocation();
  return <output aria-label="endereço">{`${l.pathname}${l.search}`}</output>;
}
function abrir(agents: SalesAgent[], podeCriar = true) {
  render(
    <MemoryRouter initialEntries={['/ia-vendedora']}>
      <Routes>
        <Route path="*" element={<><PaginaDeAgentes agents={agents} podeCriar={podeCriar} /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resumos.mockResolvedValue([{ id: 'ag-1', conversations: 74, handoffs: 46, median_reply_minutes: 4, numbers: [] }]);
});

describe('PaginaDeAgentes', () => {
  it('um quadro por agente e o tracejado "+ Novo agente" no fim', async () => {
    abrir([ag('ag-1', 'Agente A'), ag('ag-2', 'Agente B')]);
    expect(screen.getByRole('link', { name: /Agente A/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agente B/ })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links[links.length - 1]).toHaveTextContent('+ Novo agente');
    await screen.findByText(/74 conversas em 30 dias/);
  });

  it('agente juntado não aparece', async () => {
    abrir([ag('ag-1', 'Agente A'), ag('ag-2', 'Agente B', { absorbed_into_id: 'ag-1' })]);
    expect(screen.queryByText('Agente B')).toBeNull();
    await screen.findByText(/74 conversas/);
  });

  it('clicar leva a ?ia=<id>&tela=configurar, sem pagina', async () => {
    abrir([ag('ag-1', 'Agente A')]);
    await userEvent.click(screen.getByRole('link', { name: /Agente A/ }));
    expect(screen.getByLabelText('endereço').textContent).toBe('/ia-vendedora?ia=ag-1&tela=configurar');
  });

  it('lê os resumos uma vez ao abrir', async () => {
    abrir([ag('ag-1', 'Agente A'), ag('ag-2', 'Agente B')]);
    await screen.findByText(/74 conversas em 30 dias/);
    expect(resumos).toHaveBeenCalledTimes(1);
  });

  it('agente sem conversa no resumo fica sem rodapé de números, o outro mostra', async () => {
    abrir([ag('ag-1', 'Agente A'), ag('ag-2', 'Agente B')]);
    await screen.findByText(/74 conversas em 30 dias/);
    expect(screen.getAllByText(/conversas em 30 dias/)).toHaveLength(1);
  });

  it('falha nos resumos tira só o rodapé, sem aviso', async () => {
    resumos.mockRejectedValue(new Error('x'));
    abrir([ag('ag-1', 'Agente A')]);
    await waitFor(() => expect(resumos).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /Agente A/ })).toBeInTheDocument();
    expect(screen.queryByText(/conversas em 30 dias/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('conta sem agente mostra só o "+ Novo agente", que leva ao Novo agente', async () => {
    abrir([]);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    await userEvent.click(links[0]);
    expect(screen.getByLabelText('endereço').textContent).toBe('/ia-vendedora/novo');
  });

  it('sem a permissão de criar, o "+ Novo agente" não aparece', async () => {
    abrir([ag('ag-1', 'Agente A')], false);
    expect(screen.queryByText('+ Novo agente')).toBeNull();
    await screen.findByText(/74 conversas/);
  });
});
