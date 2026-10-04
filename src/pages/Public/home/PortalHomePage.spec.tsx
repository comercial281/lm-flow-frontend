import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalHomePage from '../PortalHomePage';
import type { PortalProperty, SiteInfo } from '../portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Página inicial do site público montada por blocos (Meu site, projeto C):
   capa com busca configurável, vitrines, chamadas e mais buscados. O servidor
   é simulado pelo fetch: `/site` devolve o site e `/site/properties` o catálogo.
──────────────────────────────────────────────────────────────────────────── */

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const empreendimento = (code: string, o: Partial<PortalProperty> = {}) =>
  imovel(code, { listing_kind: 'development', stage: 'launch', ...o });

/** Destino da busca: mostra a URL a que a capa levou. */
function Busca() {
  const { search } = useLocation();
  return <p data-testid="busca">{search}</p>;
}

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

function servidor(site: SiteInfo, items: PortalProperty[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: site });
    return resposta({});
  }));
}

async function abrirHome(site: SiteInfo, items: PortalProperty[]) {
  servidor({ name: 'Imob Teste', ...site }, items);
  render(
    <MemoryRouter initialEntries={['/portal/imob']}>
      <Routes>
        <Route path="/portal/:tenant" element={<PortalHomePage />} />
        <Route path="/portal/:tenant/imoveis" element={<Busca />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('PortalHomePage por blocos', () => {
  it('site que nunca abriu o Personalizar: capa de fábrica, vitrines de fábrica e só as abas com imóvel', async () => {
    await abrirHome({}, [imovel('R1', { featured: true, title: 'Casa destaque' }), empreendimento('E1', { title: 'Torre Nova' })]);

    expect(screen.getByRole('heading', { level: 1, name: 'O imóvel certo pra sua próxima fase.' })).toBeInTheDocument();

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Torre Nova')).toBeInTheDocument();
    expect(within(lanc).queryByText('Casa destaque')).toBeNull();
    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    expect(within(dest).getByText('Casa destaque')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lançamentos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alugar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Alugar' })).toBeNull();
  });

  it('título da capa trocado e aba Lançamentos desligada (some da capa e do topo)', async () => {
    await abrirHome(
      { home: { search: { title: 'Ache seu lar', tabs: { launch: false } } } },
      [imovel('R1'), empreendimento('E1')],
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Ache seu lar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançamentos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lançamentos' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Comprar' }).length).toBeGreaterThan(0);
  });

  it('as duas vitrines de fábrica desligadas e nenhuma livre: nenhum título de vitrine', async () => {
    await abrirHome(
      { home: { showcases: [
        { id: 'launches', kind: 'launches', enabled: false, title: 'Lançamentos' },
        { id: 'featured', kind: 'featured', enabled: false, title: 'Imóveis em destaque' },
      ] } },
      [imovel('R1', { featured: true }), empreendimento('E1')],
    );

    expect(screen.queryByRole('heading', { level: 2, name: 'Lançamentos' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Imóveis em destaque' })).toBeNull();
    expect(screen.queryByText('Ver todos')).toBeNull();
  });

  it('chamadas em cartões com financiamento e anuncie ligados', async () => {
    await abrirHome(
      { financiamento: { enabled: true }, anuncie: { enabled: true }, home: { callouts: { layout: 'cards' } } },
      [imovel('R1')],
    );

    const faixa = screen.getByText('Faça uma simulação').closest('section')!;
    expect(within(faixa).getByRole('heading', { name: 'Financiamento' })).toBeInTheDocument();
    expect(within(faixa).getByRole('heading', { name: 'Anuncie seu imóvel' })).toBeInTheDocument();
    expect(within(faixa).getByRole('link', { name: /Faça uma simulação/ })).toHaveAttribute('href', '/portal/imob/financiamento');
    expect(within(faixa).getByRole('link', { name: /Cadastre seu imóvel/ })).toHaveAttribute('href', '/portal/imob/anuncie');
    // Cartões brancos, não a faixa escura.
    expect(within(faixa).getByRole('link', { name: /Faça uma simulação/ }).className).toContain('bg-white');
  });

  it('mais buscados automático: 3 apartamentos no Cambuí viram atalho', async () => {
    const cambui = { city: 'Campinas', neighborhood: 'Cambuí' };
    await abrirHome({}, [imovel('A1', { address: cambui }), imovel('A2', { address: cambui }), imovel('A3', { address: cambui })]);

    expect(screen.getByRole('heading', { level: 2, name: 'Mais buscados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apartamentos em Cambuí' }))
      .toHaveAttribute('href', '/portal/imob/imoveis?type=apartment&neighborhood=Cambu%C3%AD');
  });

  it('cartão de empreendimento mostra a fase e a entrega', async () => {
    await abrirHome({}, [empreendimento('E1', { stage: 'in_construction', delivery_forecast: '2027-12-01' })]);

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Em obra · entrega dez/2027')).toBeInTheDocument();
  });

  it('busca da capa na aba Alugar leva faixa de preço (do aluguel) e suítes para a URL', async () => {
    await abrirHome(
      { home: { search: { fields: ['price', 'suites', 'stage'] } } },
      [imovel('R1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null })],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alugar' }));
    fireEvent.change(screen.getByDisplayValue('Faixa de preço'), { target: { value: '1500-3000' } });
    fireEvent.change(screen.getByDisplayValue('Suítes'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    expect((await screen.findByTestId('busca')).textContent).toBe('?tab=rent&price_min=1500&price_max=3000&suites=2');
  });

  it('catálogo vazio: sem fileira de abas, sem vitrines, e a busca cai em Comprar', async () => {
    await abrirHome({}, []);

    expect(screen.queryByRole('button', { name: 'Comprar' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Lançamentos' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('');
  });
});
