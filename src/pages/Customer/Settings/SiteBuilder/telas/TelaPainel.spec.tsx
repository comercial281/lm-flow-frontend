import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TelaPainel from './TelaPainel';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

vi.mock('@/services/siteBuilder/siteBuilderService', () => ({
  siteBuilderService: { getDashboard: vi.fn(), listLeads: vi.fn(), aiSetup: vi.fn() },
}));

const site = { id: 's1', branding: {}, contact: {}, tracking: {}, social_links: {} } as never;
const zerado = { period_days: 30, scope: 'site', counting_since: null, visits: 0, visitors: 0, contacts: 0,
  conversion_rate: null, previous: null, published_properties: 0, top_properties: [],
  sources: ['google', 'direct', 'ads', 'social', 'other'].map(key => ({ key, count: 0, pct: 0 })) };

const montar = (irPara = vi.fn(), podeAnuncios = false) => render(
  <MemoryRouter><TelaPainel site={site} irPara={irPara} setF={vi.fn()} podeAnuncios={podeAnuncios} /></MemoryRouter>,
);

describe('TelaPainel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(siteBuilderService.listLeads).mockResolvedValue({ data: [], meta: { total: 0 } });
  });

  it('site sem visita: traço na conversão e "contando a partir de hoje"', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockResolvedValue(zerado as never);
    montar();
    await waitFor(() => expect(screen.getByText('Visitas que viraram contato')).toBeTruthy());
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getAllByText(/contando a partir de hoje/).length).toBeGreaterThan(0);
    expect(screen.getByText('Ainda sem visitas no período.')).toBeTruthy();
  });

  it('erro ao carregar mostra estado de erro, não números zerados', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockRejectedValue(new Error('x'));
    montar();
    await waitFor(() => expect(screen.getByText(/Não deu para carregar os números/)).toBeTruthy());
    expect(screen.queryByText('Visitas')).toBeNull();
  });

  it('trocar o período busca de novo', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockResolvedValue(zerado as never);
    montar();
    await waitFor(() => expect(siteBuilderService.getDashboard).toHaveBeenCalledWith('s1', { period: 30, scope: 'site' }));
    await userEvent.click(screen.getByText('90 dias'));
    await waitFor(() => expect(siteBuilderService.getDashboard).toHaveBeenCalledWith('s1', { period: 90, scope: 'site' }));
  });

  it('"Páginas de anúncio" só aparece com a função liberada', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockResolvedValue(zerado as never);
    const { unmount } = montar();
    await screen.findByText('Visitas');
    expect(screen.queryByText('Páginas de anúncio')).toBeNull();
    unmount();
    montar(vi.fn(), true);
    expect(screen.getByText('Páginas de anúncio')).toBeTruthy();
    await screen.findByText('Visitas');
  });

  it('403 nos contatos esconde o bloco; "Ver todos" abre Contatos do site', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockResolvedValue(zerado as never);
    vi.mocked(siteBuilderService.listLeads).mockRejectedValueOnce({ response: { status: 403 } });
    const a = montar();
    await waitFor(() => expect(screen.queryByText('Contatos recentes do site')).toBeNull());
    a.unmount();

    const irPara = vi.fn();
    montar(irPara);
    await userEvent.click(await screen.findByText('Ver todos'));
    expect(irPara).toHaveBeenCalledWith('contatos');
  });

  it('item pendente de "pronto" leva para a tela dele', async () => {
    vi.mocked(siteBuilderService.getDashboard).mockResolvedValue(zerado as never);
    const irPara = vi.fn();
    montar(irPara);
    expect(screen.getByText('Seu site está 0% pronto')).toBeTruthy();
    await userEvent.click(screen.getByText('Dados de contato'));
    expect(irPara).toHaveBeenCalledWith('dados');
  });
});
