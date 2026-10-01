// src/pages/Customer/DashboardNova/ListaRapida.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ListaItem, ListaKind, ListaRapidaPayload } from './types';
import type { PodeAbrir } from './usePodeAbrir';

const fetchList = vi.fn();
vi.mock('@/services/dashboard/dashboardMetricsService', () => ({ fetchDashboardList: (...a: unknown[]) => fetchList(...a) }));
const navegar = vi.fn();
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import { ListaRapida, detalheDoItem } from './ListaRapida';

const TUDO: PodeAbrir = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };

interface Opcoes { aberta?: boolean; pode?: PodeAbrir; limitado?: boolean; onFechar?: () => void }

const tela = (kind: ListaKind, titulo: string, o: Opcoes = {}) => (
  <MemoryRouter>
    <ListaRapida aberta={o.aberta ?? true} kind={kind} titulo={titulo} pode={o.pode ?? TUDO} limitado={o.limitado}
      filtros={{ preset: 'last_7_days', inboxId: 'i1' }} onFechar={o.onFechar ?? vi.fn()} />
  </MemoryRouter>
);

const abrir = (o: Opcoes = {}) => render(tela('sem_responsavel', 'Leads sem responsável', o));

const conversa = (nome: string): ListaItem => ({
  id: nome, title: nome, subtitle: null, owner_name: null, since: null, open: { type: 'conversation', id: nome },
});
const payload = (kind: ListaKind, items: ListaItem[], total = items.length): ListaRapidaPayload => ({ kind, total, items });
const umItem = (kind: ListaKind, nome: string, total = 1) => payload(kind, [conversa(nome)], total);

const pendente = () => {
  let soltar: (p: ListaRapidaPayload) => void = () => {};
  fetchList.mockImplementationOnce(() => new Promise<ListaRapidaPayload>(r => { soltar = r; }));
  return (p: ListaRapidaPayload) => act(async () => { soltar(p); });
};

describe('detalheDoItem', () => {
  const item = (open: ListaItem['open']): ListaItem => ({
    id: 'x', title: 'Fulano', subtitle: null, owner_name: 'Ana', since: '2026-09-28T14:32:00Z', open,
  });
  const card = { type: 'card' as const, pipeline_id: 'p1', item_id: 'i1' };

  it('lead do período diz quando entrou, não "desde" (que soa como parado)', () => {
    expect(detalheDoItem(item(card), 'leads_periodo')).toMatch(/^Ana · entrou em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
  });

  it('as pendências continuam com "desde", e a visita com "visita em"', () => {
    expect(detalheDoItem(item(card), 'sem_responsavel')).toMatch(/^Ana · desde \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
    expect(detalheDoItem(item({ type: 'conversation', id: 'c1' }), 'conversas_periodo')).toMatch(/· desde /);
    expect(detalheDoItem(item({ type: 'visit', id: 'v1' }), 'visitas_a_confirmar')).toMatch(/· visita em /);
  });
});

describe('ListaRapida', () => {
  beforeEach(() => { fetchList.mockReset(); navegar.mockReset(); });

  it('busca a lista com os filtros da tela e abre o card ao clicar', async () => {
    fetchList.mockResolvedValue(payload('sem_responsavel', [
      { id: 'i1', title: 'Fulano', subtitle: null, owner_name: null, since: '2026-09-28T14:00:00Z', open: { type: 'card', pipeline_id: 'p1', item_id: 'i1' } },
    ]));
    const onFechar = vi.fn();
    abrir({ onFechar });

    await waitFor(() => expect(screen.getByText('Fulano')).toBeInTheDocument());
    expect(fetchList).toHaveBeenCalledWith('sem_responsavel', { preset: 'last_7_days', inbox_id: 'i1' });
    expect(screen.getByText(/^desde \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByText('1 no total')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fulano/ }));
    expect(onFechar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/pipelines/p1?card=i1');
  });

  it('visita abre a Agenda com a visita e mostra quando ela é', async () => {
    fetchList.mockResolvedValue(payload('visitas_a_confirmar', [
      { id: 'v1', title: 'Beltrano', subtitle: 'Apto', owner_name: 'Ana', since: '2026-10-03T10:00:00Z', open: { type: 'visit', id: 'v1' } },
    ]));
    abrir();
    await waitFor(() => screen.getByText('Beltrano'));
    expect(screen.getByText(/^Apto · Ana · visita em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByText(/desde/)).not.toBeInTheDocument();
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

  it('item cujo destino não abre fica como texto, sem botão', async () => {
    fetchList.mockResolvedValue(payload('sem_responsavel', [
      conversa('Ciclano'),
      { id: 'i1', title: 'Fulano', subtitle: null, owner_name: null, since: null, open: { type: 'card', pipeline_id: 'p1', item_id: 'i1' } },
      { id: 'v1', title: 'Beltrano', subtitle: null, owner_name: null, since: null, open: { type: 'visit', id: 'v1' } },
    ]));
    abrir({ pode: { ...TUDO, conversas: false, funil: false, agenda: false } });
    await waitFor(() => screen.getByText('Ciclano'));
    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.getByText('Beltrano')).toBeInTheDocument();
    ['Ciclano', 'Fulano', 'Beltrano'].forEach(nome =>
      expect(screen.queryByRole('button', { name: new RegExp(nome) })).not.toBeInTheDocument());
  });

  it('erro não vira lista vazia', async () => {
    fetchList.mockRejectedValue(new Error('rede'));
    abrir();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument());
    expect(screen.getByText('Não deu para carregar.')).toBeInTheDocument();
    expect(screen.queryByText('Nada pendente aqui')).not.toBeInTheDocument();

    fetchList.mockResolvedValue(umItem('sem_responsavel', 'Fulano'));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('Fulano')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('enquanto carrega, a descrição diz que está carregando', () => {
    pendente();
    abrir();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it.each([
    ['sem_responsavel', 'Nada pendente aqui'],
    ['leads_periodo', 'Nenhum lead no período'],
    ['conversas_periodo', 'Nenhuma conversa no período'],
  ] as const)('lista vazia de %s diz "%s"', async (kind, texto) => {
    fetchList.mockResolvedValue(payload(kind, []));
    render(tela(kind, 'Título'));
    await waitFor(() => expect(screen.getByText(texto)).toBeInTheDocument());
  });

  it('avisa quando a lista mostra só uma parte', async () => {
    fetchList.mockResolvedValue(payload('leads_periodo', [conversa('Fulano'), conversa('Beltrano')], 1200));
    abrir();
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.getByText('Mostrando 2 de 1.200')).toBeInTheDocument();
  });

  it('lista limitada: o "Mostrando" também sai com +', async () => {
    fetchList.mockResolvedValue(payload('esperando_resposta', [conversa('Fulano'), conversa('Beltrano')], 500));
    abrir({ limitado: true });
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.getByText('Mostrando 2 de 500+')).toBeInTheDocument();
  });

  it('não avisa quando a lista está inteira', async () => {
    fetchList.mockResolvedValue(umItem('leads_periodo', 'Fulano', 1));
    abrir();
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.queryByText(/^Mostrando/)).not.toBeInTheDocument();
  });

  it('total limitado aparece com +', async () => {
    fetchList.mockResolvedValue(umItem('esperando_resposta', 'Fulano', 99));
    abrir({ limitado: true });
    await waitFor(() => screen.getByText('Fulano'));
    expect(screen.getByText('99+ no total')).toBeInTheDocument();
  });

  it('resposta velha não aparece debaixo do título novo', async () => {
    const soltarVelha = pendente();
    fetchList.mockResolvedValueOnce(umItem('sem_contato', 'Novo'));

    const { rerender } = render(tela('sem_responsavel', 'Leads sem responsável'));
    rerender(tela('sem_contato', 'Leads sem contato'));
    await waitFor(() => expect(screen.getByText('Novo')).toBeInTheDocument());

    await soltarVelha(umItem('sem_responsavel', 'Velho'));
    expect(screen.queryByText('Velho')).not.toBeInTheDocument();
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('reabrir a mesma lista não mostra a de antes nem aceita a resposta da abertura anterior', async () => {
    fetchList.mockResolvedValueOnce(umItem('sem_responsavel', 'Antigo'));
    const { rerender } = render(tela('sem_responsavel', 'Leads sem responsável'));
    await waitFor(() => screen.getByText('Antigo'));

    rerender(tela('sem_responsavel', 'Leads sem responsável', { aberta: false }));
    const soltarSegunda = pendente();
    rerender(tela('sem_responsavel', 'Leads sem responsável'));
    expect(screen.queryByText('Antigo')).not.toBeInTheDocument();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();

    // Fecha e reabre de novo com a segunda busca ainda no ar: ela não vale mais.
    rerender(tela('sem_responsavel', 'Leads sem responsável', { aberta: false }));
    const soltarTerceira = pendente();
    rerender(tela('sem_responsavel', 'Leads sem responsável'));
    await soltarSegunda(umItem('sem_responsavel', 'Velho'));
    expect(screen.queryByText('Velho')).not.toBeInTheDocument();
    await soltarTerceira(umItem('sem_responsavel', 'Novo'));
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
