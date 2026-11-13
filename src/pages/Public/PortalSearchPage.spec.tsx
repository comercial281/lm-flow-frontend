import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalSearchPage from './PortalSearchPage';
import type { PortalProperty } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn() }));
import { sendSiteVisit } from '@/features/siteBuilder/public/siteVisits';
import { trackPageView } from '@/features/siteBuilder/public/siteTracking';

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

function servidor(items: PortalProperty[], site: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', ...site } });
    return resposta({});
  }));
}

/** Mostra a query atual da URL, pra conferir o que foi gravado nela. */
function SondaDaUrl() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}
const urlAtual = () => new URLSearchParams(screen.getByTestId('url').textContent ?? '');

async function abrirBusca(items: PortalProperty[], url = '/portal/imob/imoveis', site: Record<string, unknown> = {}) {
  servidor(items, site);
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/portal/:tenant/imoveis" element={<PortalSearchPage />} /></Routes>
      <SondaDaUrl />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Encontre seu imóvel' });
}

const selecionar = (rotulo: string, valor: string) => {
  const select = screen.getByRole('option', { name: rotulo }).closest('select')!;
  fireEvent.change(select, { target: { value: valor } });
};
const titulos = () => screen.queryAllByText(/^Imóvel /).map(e => e.textContent);

const ordenarPor = () => screen.getByLabelText('Ordenar por') as HTMLSelectElement;
const ordenar = (valor: string) => fireEvent.change(ordenarPor(), { target: { value: valor } });
// O título fica no h3 dos dois formatos; o <article> diz se é cartão ou linha.
const cartoes = () => screen.getAllByRole('article');

beforeEach(() => { vi.mocked(sendSiteVisit).mockClear(); vi.mocked(trackPageView).mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('PortalSearchPage', () => {
  it('cidade com grafias diferentes no cadastro vira uma opção só, com a grafia mais comum', async () => {
    await abrirBusca([
      imovel('R1'), imovel('R2'),
      imovel('R3', { address: { city: 'campinas ', neighborhood: 'centro' } }),
    ]);

    expect(screen.getAllByRole('option', { name: 'Campinas' })).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'campinas' })).toBeNull();
    expect(screen.getAllByRole('option', { name: 'Centro' })).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'centro' })).toBeNull();
  });

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

  describe('ordem e formato da lista', () => {
    // created_at: R1 mais antigo, R3 mais novo. Preço e área cruzados pra cada ordem dar uma sequência diferente:
    // recentes R3 R2 R1 · menor preço R1 R3 R2 · maior preço R2 R3 R1 · maior área R3 R1 R2.
    const CATALOGO = [
      imovel('R1', { sale_price_from: 300000, created_at: '2026-01-01T00:00:00Z', icon_summary: { useful_area_m2: 90 } }),
      imovel('R2', { sale_price_from: 900000, created_at: '2026-02-01T00:00:00Z', icon_summary: { useful_area_m2: 60 } }),
      imovel('R3', { sale_price_from: 500000, created_at: '2026-03-01T00:00:00Z', icon_summary: { useful_area_m2: 120 } }),
    ];

    it('"Ordenar por" tem as 4 opções, e a escolhida vai pra URL e muda os cartões', async () => {
      await abrirBusca(CATALOGO);

      expect([...ordenarPor().options].map(o => [o.value, o.textContent])).toEqual([
        ['recent', 'Mais recentes'], ['price_asc', 'Menor preço'], ['price_desc', 'Maior preço'], ['area_desc', 'Maior área'],
      ]);
      expect(titulos()).toEqual(['Imóvel R3', 'Imóvel R2', 'Imóvel R1']);

      ordenar('price_asc');
      expect(urlAtual().get('sort')).toBe('price_asc');
      expect(ordenarPor().value).toBe('price_asc');
      expect(titulos()).toEqual(['Imóvel R1', 'Imóvel R3', 'Imóvel R2']);

      ordenar('area_desc');
      expect(urlAtual().get('sort')).toBe('area_desc');
      expect(titulos()).toEqual(['Imóvel R3', 'Imóvel R1', 'Imóvel R2']);

      ordenar('price_desc');
      expect(titulos()).toEqual(['Imóvel R2', 'Imóvel R3', 'Imóvel R1']);
    });

    it('voltar pro padrão do site tira o ?sort= da URL', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis?sort=price_asc&city=Campinas');

      ordenar('recent');
      expect(urlAtual().has('sort')).toBe(false);
      expect(urlAtual().get('city')).toBe('Campinas');
      expect(titulos()).toEqual(['Imóvel R3', 'Imóvel R2', 'Imóvel R1']);
    });

    it('sem ?sort=, vale o padrão do site', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis', { listing: { default_sort: 'price_desc', card_layout: 'grid' } });

      expect(ordenarPor().value).toBe('price_desc');
      expect(titulos()).toEqual(['Imóvel R2', 'Imóvel R3', 'Imóvel R1']);
    });

    it('?sort= vence o padrão do site', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis?sort=area_desc', { listing: { default_sort: 'price_desc' } });

      expect(ordenarPor().value).toBe('area_desc');
      expect(titulos()).toEqual(['Imóvel R3', 'Imóvel R1', 'Imóvel R2']);
    });

    it('?sort= inválido vira o padrão do site', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis?sort=xyz', { listing: { default_sort: 'price_asc' } });

      expect(ordenarPor().value).toBe('price_asc');
      expect(titulos()).toEqual(['Imóvel R1', 'Imóvel R3', 'Imóvel R2']);
    });

    it('na aba Alugar, "Menor preço" usa o preço do aluguel', async () => {
      await abrirBusca([
        imovel('L1', { transaction_type: 'rent', sale_price_from: 100000, rent_price_from: 3000 }),
        imovel('L2', { transaction_type: 'rent', sale_price_from: 900000, rent_price_from: 1500 }),
      ], '/portal/imob/imoveis?tab=rent&sort=price_asc');

      expect(titulos()).toEqual(['Imóvel L2', 'Imóvel L1']);
    });

    it('a ordem vale antes do "Mostrar mais": os 30 primeiros já são os mais baratos', async () => {
      // 35 imóveis do mais caro pro mais barato (R1 = 35 mil … R35 = 1 mil).
      const muitos = Array.from({ length: 35 }, (_, i) => imovel(`R${i + 1}`, { sale_price_from: (35 - i) * 1000 }));
      await abrirBusca(muitos, '/portal/imob/imoveis?sort=price_asc');

      const vistos = titulos();
      expect(vistos).toHaveLength(30);
      expect(vistos[0]).toBe('Imóvel R35');
      expect(vistos).not.toContain('Imóvel R1');
      expect(screen.getByText('Mostrando 30 de 35')).toBeInTheDocument();
    });

    it('depois do "Mostrar mais", trocar a ordem volta a mostrar só os 30 primeiros', async () => {
      const muitos = Array.from({ length: 35 }, (_, i) => imovel(`R${i + 1}`, { sale_price_from: (35 - i) * 1000 }));
      await abrirBusca(muitos, '/portal/imob/imoveis?sort=price_asc');

      fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
      expect(titulos()).toHaveLength(35);
      expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull();

      ordenar('price_desc');
      const vistos = titulos();
      expect(vistos).toHaveLength(30);
      expect(vistos[0]).toBe('Imóvel R1');
      expect(vistos).not.toContain('Imóvel R35');
      expect(screen.getByText('Mostrando 30 de 35')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mostrar mais/ })).toBeInTheDocument();
    });

    it('com um imóvel só, o "Ordenar por" não aparece', async () => {
      await abrirBusca([imovel('R1')]);

      expect(screen.queryByLabelText('Ordenar por')).toBeNull();
    });

    it('card_layout "rows": a lista usa as linhas largas', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis', { listing: { card_layout: 'rows' } });

      expect(cartoes()).toHaveLength(3);
      for (const a of cartoes()) expect(a.parentElement).toHaveClass('flex-col');
      expect(cartoes()[0].parentElement).not.toHaveClass('grid');
      // linha: foto ao lado dos dados a partir do tablet
      expect(cartoes()[0]).toHaveClass('sm:grid-cols-[240px_minmax(0,1fr)]', 'lg:grid-cols-[280px_minmax(0,1fr)_220px]');
    });

    it('card_layout "grid": a grade de hoje', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis', { listing: { card_layout: 'grid' } });

      expect(cartoes()[0].parentElement).toHaveClass('grid', 'lg:grid-cols-3');
      expect(cartoes()[0]).not.toHaveClass('lg:grid-cols-[280px_minmax(0,1fr)_220px]');
    });

    it('servidor velho (sem listing): grade e "Mais recentes"', async () => {
      await abrirBusca(CATALOGO);

      expect(cartoes()[0].parentElement).toHaveClass('grid', 'lg:grid-cols-3');
      expect(ordenarPor().value).toBe('recent');
    });

    it('trocar a ordem não conta visita nova nem dispara page_view', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await abrirBusca(CATALOGO);
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(sendSiteVisit).toHaveBeenCalledTimes(1);
      expect(vi.mocked(sendSiteVisit).mock.calls[0][0]).toMatchObject({ kind: 'search', path: '/portal/imob/imoveis' });
      expect(trackPageView).toHaveBeenCalledTimes(1);

      ordenar('price_asc');
      ordenar('area_desc');
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

      expect(urlAtual().get('sort')).toBe('area_desc');
      expect(sendSiteVisit).toHaveBeenCalledTimes(1);
      expect(trackPageView).toHaveBeenCalledTimes(1);
    });

    it('"Limpar filtros" mantém a ordem escolhida', async () => {
      await abrirBusca(CATALOGO, '/portal/imob/imoveis?sort=price_asc&bedrooms=2');
      // nenhum tem quarto no resumo: a lista vem vazia, e o "Limpar filtros" do vazio limpa
      fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);

      expect(urlAtual().has('bedrooms')).toBe(false);
      expect(urlAtual().get('sort')).toBe('price_asc');
      expect(titulos()).toEqual(['Imóvel R1', 'Imóvel R3', 'Imóvel R2']);
    });
  });
});

describe('PortalSearchPage — lista do servidor (/imoveis/a-venda/casa/campinas)', () => {
  function servidorDaLista(items: PortalProperty[], lista: Record<string, { ids: string[]; titulo: string } | 'falha'>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      // VITE_API_URL não existe no teste: a URL não tem origem, então nada de new URL().
      const [caminho, query = ''] = url.split('?');
      if (caminho.endsWith('/site/properties')) {
        const chave = new URLSearchParams(query).get('listing_path');
        if (!chave) return resposta({ data: items, meta: { total: items.length } });
        const l = lista[chave];
        if (l === 'falha') return { ok: false, json: async () => ({}) };
        const dela = l ? items.filter(i => l.ids.includes(i.id)) : [];
        return resposta({ data: dela, meta: { total: dela.length, listing_title: l?.titulo ?? null } });
      }
      if (caminho.endsWith('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
      if (caminho.endsWith('/site')) return resposta({ data: { name: 'Imob Teste' } });
      return resposta({});
    }));
  }
  const abrir = (url: string) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/portal/:tenant/imoveis/*" element={<PortalSearchPage />} /></Routes>
    </MemoryRouter>,
  );

  it('título e imóveis vêm do servidor, sem as abas', async () => {
    servidorDaLista(
      [imovel('C1', { property_type: 'house' }), imovel('C2', { property_type: 'house' }), imovel('A1')],
      { 'a-venda/casa/campinas': { ids: ['C1', 'C2'], titulo: 'Casas à venda em Campinas' } },
    );
    abrir('/portal/imob/imoveis/a-venda/casa/campinas');

    await screen.findByRole('heading', { level: 1, name: 'Casas à venda em Campinas' });
    expect(titulos()).toEqual(expect.arrayContaining(['Imóvel C1', 'Imóvel C2']));
    expect(titulos()).not.toContain('Imóvel A1');
    expect(screen.queryByRole('tab', { name: /alugar/i })).toBeNull();
    expect(document.title).toBe('Casas à venda em Campinas | Imob Teste');
  });

  it('caminho que o servidor não conhece vira "Página não encontrada"', async () => {
    servidorDaLista([imovel('A1')], {});
    abrir('/portal/imob/imoveis/a-venda/nave-espacial');
    await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' });
    expect(screen.getByRole('link', { name: 'Ver imóveis' }).getAttribute('href')).toBe('/portal/imob/imoveis');
  });

  it('servidor fora do ar na lista mostra erro, não "não encontrada"', async () => {
    servidorDaLista([imovel('A1')], { 'a-venda': 'falha' });
    abrir('/portal/imob/imoveis/a-venda');
    await screen.findByText('Portal indisponível.');
    expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).toBeNull();
  });
});

const campoDeLugar = () => screen.getByRole('combobox', { name: 'Condomínio, bairro ou cidade' }) as HTMLInputElement;

describe('condomínio, bairro ou cidade e Área', () => {
  const base = () => [
    imovel('C1', { condominium_name: 'Collina Parque dos Príncipes', icon_summary: { useful_area_m2: 120 } }),
    imovel('C2', { icon_summary: { useful_area_m2: 60 } }),
  ];

  it('?condominium= filtra e o campo mostra o nome', async () => {
    await abrirBusca(base(), '/portal/imob/imoveis?condominium=Collina%20Parque%20dos%20Pr%C3%ADncipes');
    expect(await screen.findByDisplayValue(/Collina Parque dos Príncipes/)).toBeInTheDocument();
    expect(titulos()).toEqual(['Imóvel C1']);
  });

  it('?neighborhood= não preenche o campo de texto', async () => {
    await abrirBusca(base(), '/portal/imob/imoveis?neighborhood=Centro');
    expect(campoDeLugar().value).toBe('');
  });

  it('Área 100 m²+ tira o imóvel pequeno e grava area na URL', async () => {
    await abrirBusca(base());
    expect(titulos()).toHaveLength(2);
    selecionar('Área', '100');
    expect(titulos()).toEqual(['Imóvel C1']);
    expect(urlAtual().get('area')).toBe('100');
  });

  it('escolher uma sugestão grava o condomínio e mostra o rótulo', async () => {
    await abrirBusca(base());
    const campo = campoDeLugar() as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'colli' } });
    fireEvent.click(await screen.findByRole('option', { name: /Collina Parque dos Príncipes/ }));
    expect(urlAtual().get('condominium')).toBe('Collina Parque dos Príncipes');
    expect(titulos()).toEqual(['Imóvel C1']);
    expect(campoDeLugar().value).toMatch(/Collina/);
  });

  it('Enter grava o texto digitado como place e Limpar filtros esvazia o campo', async () => {
    await abrirBusca(base());
    const campo = campoDeLugar() as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'zzz' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(urlAtual().get('place')).toBe('zzz');
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(urlAtual().get('place')).toBeNull();
    expect(campoDeLugar().value).toBe('');
  });

  const comBairro = () => [
    imovel('B1', { address: { city: 'Campinas', neighborhood: 'Centro' } }),
    imovel('B2', { address: { city: 'Campinas', neighborhood: 'Cambuí' } }),
  ];
  const escolherCentro = async () => {
    const campo = campoDeLugar();
    fireEvent.change(campo, { target: { value: 'cent' } });
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Centro' }));
  };

  it('o × do campo tira o lugar escolhido (o bairro da sugestão sai junto)', async () => {
    await abrirBusca(comBairro());
    await escolherCentro();
    expect(urlAtual().get('neighborhood')).toBe('Centro');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar condomínio, bairro ou cidade' }));
    expect(urlAtual().get('neighborhood')).toBeNull();
    expect(campoDeLugar().value).toBe('');
    expect(titulos()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Limpar condomínio, bairro ou cidade' })).toBeNull();
  });

  it('escolher bairro e voltar ao campo + Enter não soma place', async () => {
    await abrirBusca(comBairro());
    await escolherCentro();
    expect(urlAtual().get('neighborhood')).toBe('Centro');
    expect(campoDeLugar().value).toBe('Centro');
    fireEvent.focus(campoDeLugar());
    fireEvent.keyDown(campoDeLugar(), { key: 'Enter' });
    expect(urlAtual().get('place')).toBeNull();
  });

  it('trocar o select de Bairro depois de escolher limpa o campo', async () => {
    await abrirBusca(comBairro());
    await escolherCentro();
    selecionar('Cambuí', 'Cambuí');
    expect(urlAtual().get('neighborhood')).toBe('Cambuí');
    expect(campoDeLugar().value).toBe('');
    expect(titulos()).toEqual(['Imóvel B2']);
  });

  it('escolher bairro e trocar o texto: o bairro sai e fica só o texto', async () => {
    await abrirBusca(comBairro());
    await escolherCentro();
    fireEvent.change(campoDeLugar(), { target: { value: 'Cambuí' } });
    fireEvent.keyDown(campoDeLugar(), { key: 'Enter' });
    expect(urlAtual().get('place')).toBe('Cambuí');
    expect(urlAtual().get('neighborhood')).toBeNull();
    expect(titulos()).toEqual(['Imóvel B2']);
  });

  it('sair do campo com Tab grava o texto digitado', async () => {
    await abrirBusca(comBairro());
    fireEvent.change(campoDeLugar(), { target: { value: 'zzz' } });
    fireEvent.blur(campoDeLugar());
    expect(urlAtual().get('place')).toBe('zzz');
  });
});
