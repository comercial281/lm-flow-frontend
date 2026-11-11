import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';

const svc = vi.hoisted(() => ({ listar: vi.fn(), salvar: vi.fn() }));
vi.mock('@/services/externalLeadPages/externalLeadPagesService', () => ({ externalLeadPagesService: svc }));
const recursos = vi.hoisted(() => ({
  labels: [], loading: false, users: [{ id: 'u1', name: 'Marina Souza' }],
  pipelines: [{ id: 'f1', name: 'Vendas' }], stagesByPipeline: { f1: [{ id: 'e1', name: 'Novo' }] },
  roletas: [{ id: 'r1', display_name: 'Roleta Kovacs', is_active: true, members: [{ is_active: true }, { is_active: true }, { is_active: false }] }],
  reloadLabels: () => {}, reloadFunnels: () => {},
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', () => ({ useAutomationResources: () => recursos }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SitesELandingPages from './SitesELandingPages';

const pagina = (extra: Partial<PaginaDeSite> = {}): PaginaDeSite => ({
  id: 'x', name: 'LP Kovacs', active: true, pipeline_id: 'f1', stage_id: 'e1', roleta_config_id: null, default_assignee_id: null,
  property_id: null, labels: ['site'], endpoint_url: 'https://api/x', last_received_at: null, leads_30d: 0, last_delivery: null, rejected_last_24h: 0, ...extra,
});
const envio = { at: '2026-11-10T16:40:00Z', outcome: 'entered' as const, summary: null, page_host: 'meuape.com.br' };

const tres = () => [
  pagina({ id: 'a', name: 'LP Kovacs', roleta_config_id: 'r1', leads_30d: 12, last_delivery: envio }),
  pagina({ id: 'b', name: 'Site Institucional', default_assignee_id: 'u1', leads_30d: 3, rejected_last_24h: 3, last_delivery: { ...envio, page_host: null } }),
  pagina({ id: 'c', name: 'LP Nova', active: false }),
];

const abrir = vi.fn();
const montar = () => render(<MemoryRouter><SitesELandingPages aoAbrir={abrir} /></MemoryRouter>);

beforeEach(() => { svc.listar.mockReset(); svc.salvar.mockReset(); abrir.mockReset(); });

describe('SitesELandingPages', () => {
  it('mostra as linhas com os selos e quem assume certos', async () => {
    svc.listar.mockResolvedValue(tres());
    montar();
    const [a, b, c] = await screen.findAllByTestId('linha-da-pagina');
    expect(within(a).getByText('LP Kovacs')).toBeInTheDocument();
    expect(within(a).getByText('meuape.com.br')).toBeInTheDocument();
    expect(within(a).getByText('Vendas › Novo')).toBeInTheDocument();
    expect(within(a).getByText('Roleta Kovacs')).toBeInTheDocument();
    expect(within(a).getByText('2 corretores na fila')).toBeInTheDocument();
    expect(within(a).getByText(/10\/11\/2026/)).toBeInTheDocument();
    expect(within(b).getByText('Marina Souza')).toBeInTheDocument();
    expect(within(b).getByText('Corretor fixo')).toBeInTheDocument();
    expect(within(b).getByText('3 recusados')).toBeInTheDocument();
    expect(within(c).getByText('Ninguém')).toBeInTheDocument();
    expect(within(c).getByText('Entra sem responsável')).toBeInTheDocument();
    expect(within(c).getByText('Esperando o 1º envio')).toBeInTheDocument();
  });

  it('plural: 1 recusado; envio com falha vira erro', async () => {
    svc.listar.mockResolvedValue([
      pagina({ id: 'a', rejected_last_24h: 1, last_delivery: envio }),
      pagina({ id: 'b', last_delivery: { ...envio, outcome: 'failed' } }),
    ]);
    montar();
    expect(await screen.findByText('1 recusado')).toBeInTheDocument();
    expect(screen.getByText('Erro no último envio')).toBeInTheDocument();
  });

  it('clicar na linha abre; clicar na chave salva na hora e não abre', async () => {
    svc.listar.mockResolvedValue(tres());
    svc.salvar.mockResolvedValue(pagina({ id: 'c', name: 'LP Nova', active: true }));
    montar();
    const linhas = await screen.findAllByTestId('linha-da-pagina');
    fireEvent.click(linhas[1]);
    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    abrir.mockClear();
    fireEvent.click(within(linhas[2]).getByRole('switch'));
    await waitFor(() => expect(svc.salvar).toHaveBeenCalledWith('c', { active: true }));
    expect(abrir).not.toHaveBeenCalled();
  });

  it('lista vazia: estado vazio com + Nova página', async () => {
    svc.listar.mockResolvedValue([]);
    montar();
    expect(await screen.findByText('Ligue a primeira página')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nova página/ }));
    expect(abrir).toHaveBeenCalledWith(null);
  });

  it('falha ao carregar: erro, não lista vazia', async () => {
    svc.listar.mockRejectedValue(new Error('500'));
    montar();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Ligue a primeira página')).toBeNull();
  });
});
