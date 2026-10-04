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

  it('?city=campinas (minúscula, de vitrine/atalho) filtra e o seletor marca "Campinas"', async () => {
    await abrirBusca([imovel('R1'), imovel('R2', { address: { city: 'Santos', neighborhood: 'Gonzaga' } })],
      '/portal/imob/imoveis?city=CAMP%C3%8DNAS%20&neighborhood=centro');

    expect(titulos()).toEqual(['Imóvel R1']);
    const cidade = screen.getByRole('option', { name: 'Cidade' }).closest('select') as HTMLSelectElement;
    expect(cidade.value).toBe('Campinas');
    expect(screen.getAllByRole('option', { name: 'Campinas' })).toHaveLength(1);
    const bairro = screen.getByRole('option', { name: 'Bairro' }).closest('select') as HTMLSelectElement;
    expect(bairro.value).toBe('Centro');
  });

  it('cidade da URL que não está na lista vira opção marcada (o campo não fica no rótulo vazio)', async () => {
    await abrirBusca([imovel('R1')], '/portal/imob/imoveis?city=Sorocaba');

    const cidade = screen.getByRole('option', { name: 'Cidade' }).closest('select') as HTMLSelectElement;
    expect(cidade.value).toBe('Sorocaba');
    expect(titulos()).toEqual([]);
  });

  it('?price_max=350000 (fora das faixas prontas) mostra "Até R$ 350.000" marcado', async () => {
    await abrirBusca([imovel('R1', { sale_price_from: 300000 }), imovel('R2')], '/portal/imob/imoveis?price_max=350000');

    expect(titulos()).toEqual(['Imóvel R1']);
    const preco = screen.getByRole('option', { name: 'Faixa de preço' }).closest('select') as HTMLSelectElement;
    expect(preco.value).toBe('-350000');
    expect(preco.selectedOptions[0].textContent?.replace(/\s/g, ' ')).toBe('Até R$ 350.000');
  });

  it('?price_min&price_max fora das faixas: "R$ X a R$ Y"', async () => {
    await abrirBusca([imovel('R1')], '/portal/imob/imoveis?price_min=450000&price_max=550000');

    const preco = screen.getByRole('option', { name: 'Faixa de preço' }).closest('select') as HTMLSelectElement;
    expect(preco.selectedOptions[0].textContent?.replace(/\s/g, ' ')).toBe('R$ 450.000 a R$ 550.000');
  });

  it('na aba Alugar o filtro Fase some e um ?stage= da URL não zera a lista', async () => {
    const aluguel = imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null });
    await abrirBusca([imovel('R1'), aluguel, empreendimento('E1')], '/portal/imob/imoveis?tab=rent&stage=ready');

    expect(screen.queryByRole('option', { name: 'Fase' })).toBeNull();
    expect(titulos()).toEqual(['Imóvel L1']);
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));
    expect(screen.getByRole('option', { name: 'Fase' })).toBeInTheDocument();
  });
});
