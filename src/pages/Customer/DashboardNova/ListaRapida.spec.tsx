// src/pages/Customer/DashboardNova/ListaRapida.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ListaKind, ListaRapidaPayload } from './types';

const fetchList = vi.fn();
vi.mock('@/services/dashboard/dashboardMetricsService', () => ({ fetchDashboardList: (...a: unknown[]) => fetchList(...a) }));
const navegar = vi.fn();
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import { ListaRapida } from './ListaRapida';

const tela = (kind: ListaKind, titulo: string, onFechar = vi.fn()) => (
  <MemoryRouter>
    <ListaRapida aberta kind={kind} titulo={titulo}
      filtros={{ preset: 'last_7_days', inboxId: 'i1' }} onFechar={onFechar} />
  </MemoryRouter>
);

const abrir = (onFechar = vi.fn()) => render(tela('sem_responsavel', 'Leads sem responsável', onFechar));

const umItem = (kind: ListaKind, nome: string, total = 1): ListaRapidaPayload => ({
  kind, total,
  items: [{ id: nome, title: nome, subtitle: null, owner_name: null, since: null, open: { type: 'conversation', id: nome } }],
});

describe('ListaRapida', () => {
  beforeEach(() => { fetchList.mockReset(); navegar.mockReset(); });

  it('busca a lista com os filtros da tela e abre o card ao clicar', async () => {
    fetchList.mockResolvedValue({
      kind: 'sem_responsavel', total: 1,
      items: [{ id: 'i1', title: 'Fulano', subtitle: null, owner_name: null, since: '2026-09-28T14:00:00Z', open: { type: 'card', pipeline_id: 'p1', item_id: 'i1' } }],
    });
    const onFechar = vi.fn();
    abrir(onFechar);

    await waitFor(() => expect(screen.getByText('Fulano')).toBeInTheDocument());
    expect(fetchList).toHaveBeenCalledWith('sem_responsavel', { preset: 'last_7_days', inbox_id: 'i1' });
    expect(screen.getByText(/^desde \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fulano/ }));
    expect(onFechar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/pipelines/p1?card=i1');
  });

  it('visita abre a Agenda com a visita', async () => {
    fetchList.mockResolvedValue({
      kind: 'visitas_a_confirmar', total: 1,
      items: [{ id: 'v1', title: 'Beltrano', subtitle: 'Apto', owner_name: 'Ana', since: null, open: { type: 'visit', id: 'v1' } }],
    });
    abrir();
    await waitFor(() => screen.getByText('Beltrano'));
    expect(screen.getByText('Apto · Ana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Beltrano/ }));
    expect(navegar).toHaveBeenCalledWith('/visits?visita=v1');
  });

  it('conversa abre a conversa', async () => {
    fetchList.mockResolvedValue(umItem('esperando_resposta', 'Ciclano'));
    abrir();
    await waitFor(() => screen.getByText('Ciclano'));
    fireEvent.click(screen.getByRole('button', { name: /Ciclano/ }));
    expect(navegar).toHaveBeenCalledWith('/conversations/Ciclano');
  });

  it('erro não vira lista vazia', async () => {
    fetchList.mockRejectedValue(new Error('rede'));
    abrir();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument());
    expect(screen.queryByText('Nada pendente aqui')).not.toBeInTheDocument();

    fetchList.mockResolvedValue(umItem('sem_responsavel', 'Fulano'));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('Fulano')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('avisa quando a lista mostra só os primeiros', async () => {
    const dois = umItem('leads_periodo', 'Fulano', 1200);
    dois.items.push({ ...dois.items[0], id: 'Beltrano', title: 'Beltrano' });
    fetchList.mockResolvedValue(dois);
    abrir();
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.getByText('Mostrando os 2 primeiros de 1.200')).toBeInTheDocument();
  });

  it('não avisa quando a lista está inteira', async () => {
    fetchList.mockResolvedValue(umItem('leads_periodo', 'Fulano', 1));
    abrir();
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.queryByText(/^Mostrando os/)).not.toBeInTheDocument();
  });

  it('resposta velha não aparece debaixo do título novo', async () => {
    let soltarVelha: (p: ListaRapidaPayload) => void = () => {};
    fetchList.mockImplementationOnce(() => new Promise<ListaRapidaPayload>(r => { soltarVelha = r; }));
    fetchList.mockResolvedValueOnce(umItem('sem_contato', 'Novo'));

    const { rerender } = render(tela('sem_responsavel', 'Leads sem responsável'));
    rerender(tela('sem_contato', 'Leads sem contato'));
    await waitFor(() => expect(screen.getByText('Novo')).toBeInTheDocument());

    soltarVelha(umItem('sem_responsavel', 'Velho'));
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText('Velho')).not.toBeInTheDocument();
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('não busca de novo só porque a tela redesenhou com os mesmos filtros', async () => {
    fetchList.mockResolvedValue(umItem('sem_responsavel', 'Fulano'));
    const { rerender } = render(tela('sem_responsavel', 'Leads sem responsável'));
    await waitFor(() => screen.getByText('Fulano'));
    rerender(tela('sem_responsavel', 'Leads sem responsável'));
    rerender(tela('sem_responsavel', 'Leads sem responsável'));
    expect(fetchList).toHaveBeenCalledTimes(1);
  });
});
