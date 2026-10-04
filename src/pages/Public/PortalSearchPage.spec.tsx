import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalSearchPage from './PortalSearchPage';
import type { PortalProperty } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
import { sendSiteVisit } from '@/features/siteBuilder/public/siteVisits';

/* ────────────────────────────────────────────────────────────────────────────
   Busca do site público: abas só as visíveis, filtros novos (preço, suítes,
   vagas, fase) na URL e a visita da busca levando os filtros depois de 1,5 s.
──────────────────────────────────────────────────────────────────────────── */

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const empreendimento = (code: string, o: Partial<PortalProperty> = {}) =>
  imovel(code, { listing_kind: 'development', stage: 'launch', ...o });

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

function servidor(items: PortalProperty[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste' } });
    return resposta({});
  }));
}

async function abrirBusca(items: PortalProperty[], url = '/portal/imob/imoveis') {
  servidor(items);
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/portal/:tenant/imoveis" element={<PortalSearchPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Encontre seu imóvel' });
}

const selecionar = (rotulo: string, valor: string) => {
  const select = screen.getByRole('option', { name: rotulo }).closest('select')!;
  fireEvent.change(select, { target: { value: valor } });
};
const titulos = () => screen.queryAllByText(/^Imóvel /).map(e => e.textContent);

beforeEach(() => { vi.mocked(sendSiteVisit).mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('PortalSearchPage', () => {
  it('?tab=launch mostra só empreendimentos; Alugar não aparece sem imóvel de aluguel', async () => {
    await abrirBusca([imovel('R1'), empreendimento('E1')], '/portal/imob/imoveis?tab=launch');

    expect(titulos()).toEqual(['Imóvel E1']);
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lançamentos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alugar' })).toBeNull();
  });

  it('?price_max=600000 tira o imóvel de 800 mil e o empreendimento sem preço', async () => {
    await abrirBusca(
      [imovel('R1'), imovel('R2', { sale_price_from: 800000 }), empreendimento('E1', { sale_price_from: null })],
      '/portal/imob/imoveis?price_max=600000',
    );

    expect(titulos()).toEqual(['Imóvel R1']);
  });

  it('escolher "Fase: Em obra" grava stage=in_construction na URL e filtra', async () => {
    await abrirBusca([imovel('R1'), empreendimento('E1', { stage: 'in_construction' }), empreendimento('E2', { stage: 'ready' })]);
    expect(titulos()).toHaveLength(3);

    selecionar('Em obra', 'in_construction');

    expect(titulos()).toEqual(['Imóvel E1']);
    expect((screen.getByRole('option', { name: 'Em obra' }).closest('select') as HTMLSelectElement).value).toBe('in_construction');
  });

  it('a visita da busca é uma só por carga, depois de 1,5 s, com os filtros da hora', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrirBusca([imovel('R1'), empreendimento('E1', { stage: 'in_construction' })]);
    selecionar('Em obra', 'in_construction');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(sendSiteVisit).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sendSiteVisit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSiteVisit).mock.calls[0][0]).toMatchObject({ kind: 'search', path: '/portal/imob/imoveis?stage=in_construction' });

    selecionar('Em obra', '');
    selecionar('Suítes', '1');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(sendSiteVisit).toHaveBeenCalledTimes(1);
  });
});
