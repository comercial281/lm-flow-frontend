import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImovelPublicPage from './ImovelPublicPage';
import type { SiteInfo } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Ficha do imóvel: o topo e o rodapé mostram só as abas ligadas no
   Personalizar (a ficha não carrega o catálogo, então não esconde aba vazia).
   C2: a ficha obedece a "Página do imóvel" (site.property_page) e mostra os
   campos novos do cadastro só quando eles vêm.
──────────────────────────────────────────────────────────────────────────── */

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

const PARECIDO = { id: 'p2', code: 'C2', title: 'Apartamento parecido', transaction_type: 'sale', address: { city: 'Campinas' } };

// Revenda "de hoje": o que o servidor velho manda, sem nenhum campo do C2.
const REVENDA = {
  code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', photos: [],
  sale_price: 500000, condo_fee: 800, iptu: 1200, useful_area_m2: 100,
  address_neighborhood: 'Cambuí', address_city: 'Campinas', address_state: 'SP',
};

const EMPREENDIMENTO = {
  ...REVENDA,
  title: 'Residencial Aurora', listing_kind: 'development', property_type: 'apartment',
  stage: 'in_construction', delivery_forecast: '2027-03-01',
  latitude: -22.9, longitude: -47.06,
  typologies: [{ name: 'Planta A', bedrooms: 2, useful_area_m2: 60, sale_price: 400000 }],
};

async function abrirFicha(site: SiteInfo, imovel: Record<string, unknown> = {}, base: Record<string, unknown> = REVENDA) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/site/properties/C1')) return resposta({ data: { ...base, ...imovel } });
    if (url.includes('/site/properties')) return resposta({ data: [PARECIDO], meta: { total: 1 } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', ...site } });
    return resposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={['/imovel/imob/C1']}>
      <Routes><Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: String(imovel.title ?? base.title) });
  return fetchMock;
}

const pediuParecidos = (f: ReturnType<typeof vi.fn>) => f.mock.calls.some(([u]) => /\/site\/properties\?/.test(String(u)));

afterEach(() => { vi.unstubAllGlobals(); });

describe('ImovelPublicPage', () => {
  it('aba Lançamentos desligada não aparece no topo nem no rodapé da ficha', async () => {
    await abrirFicha({ home: { search: { tabs: { launch: false } } } });

    expect(screen.queryByRole('link', { name: 'Lançamentos' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Comprar' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Alugar' }).length).toBeGreaterThan(0);
  });

  it('site sem Personalizar: as três abas', async () => {
    await abrirFicha({});

    expect(screen.getAllByRole('link', { name: 'Lançamentos' }).length).toBeGreaterThan(0);
  });

  it('tipo condo_house aparece como "Casa em condomínio", nunca o código cru', async () => {
    await abrirFicha({}, { property_type: 'condo_house' });

    expect(screen.getByRole('heading', { level: 1 }).previousElementSibling).toHaveTextContent(/^Casa em condomínio$/);
    expect(screen.queryByText('condo_house')).toBeNull();
  });

  describe('revenda', () => {
    it('values: false some com Condomínio, IPTU e Valor do m²', async () => {
      await abrirFicha({ property_page: { resale: { values: false } } });

      expect(screen.queryByText('Condomínio')).toBeNull();
      expect(screen.queryByText('IPTU')).toBeNull();
      expect(screen.queryByText('Valor do m²')).toBeNull();
    });

    it('map: false some com o mapa', async () => {
      await abrirFicha({ property_page: { resale: { map: false } } });

      expect(screen.queryByRole('heading', { name: 'Localização' })).toBeNull();
      expect(screen.queryByTitle('Mapa da região')).toBeNull();
    });

    it('similar: false some com "Você também pode gostar" e a lista nem é pedida', async () => {
      const f = await abrirFicha({ property_page: { resale: { similar: false } } });

      // esvazia os efeitos pendentes: se fosse pedir a lista, já teria pedido
      await act(async () => {});
      expect(pediuParecidos(f)).toBe(false);
      expect(screen.queryByRole('heading', { name: 'Você também pode gostar' })).toBeNull();
    });

    it('IPTU mensal aparece "/mês"', async () => {
      await abrirFicha({}, { iptu_period: 'monthly', iptu: 100 });

      expect(screen.getAllByText('R$ 100/mês').length).toBeGreaterThan(0);
      expect(screen.queryByText('R$ 100/ano')).toBeNull();
    });
  });

  describe('empreendimento', () => {
    it('mostra a fase e a previsão perto do preço', async () => {
      await abrirFicha({}, {}, EMPREENDIMENTO);

      const aside = screen.getByRole('complementary');
      expect(within(aside).getByText('Em obra · entrega mar/2027')).toBeInTheDocument();
      // no formulário do celular e na barra fixa também
      expect(screen.getAllByText('Em obra · entrega mar/2027').length).toBeGreaterThanOrEqual(3);
    });

    it('stage_and_forecast: false esconde a fase', async () => {
      await abrirFicha({ property_page: { development: { stage_and_forecast: false } } }, {}, EMPREENDIMENTO);

      expect(screen.queryByText('Em obra · entrega mar/2027')).toBeNull();
    });

    it('revenda não mostra fase, mesmo com stage no cadastro', async () => {
      await abrirFicha({}, { stage: 'in_construction', delivery_forecast: '2027-03-01' });

      expect(screen.queryByText(/Em obra/)).toBeNull();
    });

    it('tipologias aparecem com a chave ligada (padrão)', async () => {
      await abrirFicha({}, {}, EMPREENDIMENTO);
      expect(screen.getByRole('heading', { name: 'Tipologias disponíveis' })).toBeInTheDocument();
    });

    it('typologies: false some com o quadro', async () => {
      await abrirFicha({ property_page: { development: { typologies: false } } }, {}, EMPREENDIMENTO);

      expect(screen.queryByRole('heading', { name: 'Tipologias disponíveis' })).toBeNull();
      expect(screen.queryByText('Planta A')).toBeNull();
    });

    it('map: false da revenda não mexe no mapa do empreendimento', async () => {
      await abrirFicha({ property_page: { resale: { map: false } } }, {}, EMPREENDIMENTO);
      expect(screen.getByTitle('Mapa do empreendimento')).toBeInTheDocument();
    });

    it('map: false do empreendimento some com o mapa', async () => {
      await abrirFicha({ property_page: { development: { map: false } } }, {}, EMPREENDIMENTO);
      expect(screen.queryByTitle('Mapa do empreendimento')).toBeNull();
    });

    it('similar: false do empreendimento não pede a lista', async () => {
      const f = await abrirFicha({ property_page: { development: { similar: false } } }, {}, EMPREENDIMENTO);
      await act(async () => {});
      expect(pediuParecidos(f)).toBe(false);
    });

    it('construtora com site vira link', async () => {
      await abrirFicha({}, { builder: { name: 'Construtora Alfa', website: 'https://alfa.com.br' } }, EMPREENDIMENTO);

      const link = screen.getByRole('link', { name: 'Construtora Alfa' });
      expect(link).toHaveAttribute('href', 'https://alfa.com.br');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.parentElement).toHaveTextContent('Construtora: Construtora Alfa');
    });

    it('construtora sem site: só o nome, sem link', async () => {
      await abrirFicha({}, { builder: { name: 'Construtora Alfa', website: null } }, EMPREENDIMENTO);

      expect(screen.getByText('Construtora Alfa')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Construtora Alfa' })).toBeNull();
      expect(screen.getByText('Construtora Alfa').parentElement).toHaveTextContent('Construtora: Construtora Alfa');
    });

    it('builder: false esconde a construtora', async () => {
      await abrirFicha({ property_page: { development: { builder: false } } }, { builder: { name: 'Construtora Alfa', website: null } }, EMPREENDIMENTO);

      expect(screen.queryByText(/Construtora Alfa/)).toBeNull();
    });

    it('dados do prédio: torres, andares, unidades e padrão, só os que existem', async () => {
      await abrirFicha({}, { towers: 2, floors: 18, total_units: null, building_standard: 'high' }, EMPREENDIMENTO);

      const secao = screen.getByRole('heading', { name: 'Dados do empreendimento' }).closest('section')!;
      expect(within(secao).getByText('Torres')).toBeInTheDocument();
      expect(within(secao).getByText('2')).toBeInTheDocument();
      expect(within(secao).getByText('Andares')).toBeInTheDocument();
      expect(within(secao).getByText('18')).toBeInTheDocument();
      expect(within(secao).getByText('Padrão')).toBeInTheDocument();
      expect(within(secao).getByText('Alto')).toBeInTheDocument();
      expect(within(secao).queryByText('Unidades')).toBeNull();
    });

    it('revenda não mostra dados do prédio', async () => {
      await abrirFicha({}, { towers: 2, floors: 18 });
      expect(screen.queryByRole('heading', { name: 'Dados do empreendimento' })).toBeNull();
    });
  });

  describe('selos', () => {
    it('os três aparecem com financing_badges ligado e cadastro "sim"', async () => {
      await abrirFicha({}, { accepts_financing: true, accepts_fgts: true, mcmv: true });

      expect(screen.getByText('Aceita financiamento')).toBeInTheDocument();
      expect(screen.getByText('Aceita FGTS')).toBeInTheDocument();
      expect(screen.getByText('Minha Casa Minha Vida')).toBeInTheDocument();
    });

    it('null ou false não mostra o selo', async () => {
      await abrirFicha({}, { accepts_financing: null, accepts_fgts: false, mcmv: true });

      expect(screen.queryByText('Aceita financiamento')).toBeNull();
      expect(screen.queryByText('Aceita FGTS')).toBeNull();
      expect(screen.getByText('Minha Casa Minha Vida')).toBeInTheDocument();
    });

    it('financing_badges: false não mostra nenhum', async () => {
      await abrirFicha({ property_page: { financing_badges: false } }, { accepts_financing: true, accepts_fgts: true, mcmv: true });

      expect(screen.queryByText('Aceita financiamento')).toBeNull();
      expect(screen.queryByText('Aceita FGTS')).toBeNull();
      expect(screen.queryByText('Minha Casa Minha Vida')).toBeNull();
    });

    it('"Muito procurado" aparece com popular: true e a chave ligada', async () => {
      await abrirFicha({}, { popular: true });
      expect(screen.getByText('Muito procurado')).toBeInTheDocument();
    });

    it('"Muito procurado" some com popular_badge desligado', async () => {
      await abrirFicha({ property_page: { resale: { popular_badge: false } } }, { popular: true });
      expect(screen.queryByText('Muito procurado')).toBeNull();
    });

    it('"Muito procurado" do empreendimento segue a chave do empreendimento', async () => {
      await abrirFicha({ property_page: { development: { popular_badge: false } } }, { popular: true }, EMPREENDIMENTO);
      expect(screen.queryByText('Muito procurado')).toBeNull();
    });

    it('sem popular, nada de "Muito procurado"', async () => {
      await abrirFicha({}, { popular: false });
      expect(screen.queryByText('Muito procurado')).toBeNull();
    });
  });

  describe('vídeo e tour', () => {
    it('YouTube vira iframe do youtube-nocookie', async () => {
      await abrirFicha({}, { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10' });

      const iframe = screen.getByTitle('Vídeo do imóvel');
      expect(iframe.tagName).toBe('IFRAME');
      expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(iframe).toHaveAttribute('loading', 'lazy');
      expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      expect(iframe).toHaveAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
    });

    it('domínio desconhecido vira botão-link, nunca iframe', async () => {
      await abrirFicha({}, { video_url: 'https://exemplo.com.br/video.mp4' });

      expect(screen.queryByTitle('Vídeo do imóvel')).toBeNull();
      const link = screen.getByRole('link', { name: 'Ver vídeo' });
      expect(link).toHaveAttribute('href', 'https://exemplo.com.br/video.mp4');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('sem video_url, nada', async () => {
      await abrirFicha({}, { video_url: null });

      expect(screen.queryByTitle('Vídeo do imóvel')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Ver vídeo' })).toBeNull();
    });

    it('javascript: não aparece', async () => {
      await abrirFicha({}, { video_url: 'javascript:alert(1)' });

      expect(screen.queryByTitle('Vídeo do imóvel')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Ver vídeo' })).toBeNull();
    });

    it('tour Matterport vira iframe', async () => {
      await abrirFicha({}, { virtual_tour_url: 'https://my.matterport.com/show/?m=SxQL3iGyoDo' });

      const iframe = screen.getByTitle('Tour virtual do imóvel');
      expect(iframe.tagName).toBe('IFRAME');
      expect(iframe).toHaveAttribute('src', 'https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1');
      expect(iframe).toHaveAttribute('loading', 'lazy');
      expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      expect(iframe).toHaveAttribute('allow', 'fullscreen; xr-spatial-tracking');
    });

    it('tour de outro endereço vira botão "Fazer o tour virtual"', async () => {
      await abrirFicha({}, { virtual_tour_url: 'https://tour.exemplo.com/123' });

      expect(screen.getByRole('link', { name: 'Fazer o tour virtual' })).toHaveAttribute('href', 'https://tour.exemplo.com/123');
    });
  });

  it('servidor velho, sem campos novos e sem property_page: a ficha de hoje', async () => {
    const f = await abrirFicha({});

    // tipo ausente: "Imóvel", como hoje (o rótulo fica logo acima do título)
    expect(screen.getByRole('heading', { level: 1 }).previousElementSibling).toHaveTextContent(/^Imóvel$/);
    // valores, mapa e parecidos continuam
    expect(screen.getAllByText('Condomínio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 1.200/ano').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Valor do m²').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Mapa da região')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Você também pode gostar' })).toBeInTheDocument();
    await waitFor(() => expect(pediuParecidos(f)).toBe(true));
    // e nada do que é novo
    for (const t of ['Aceita financiamento', 'Aceita FGTS', 'Minha Casa Minha Vida', 'Muito procurado', 'Ver vídeo', 'Fazer o tour virtual']) {
      expect(screen.queryByText(t)).toBeNull();
    }
    expect(screen.queryByTitle('Vídeo do imóvel')).toBeNull();
    expect(screen.queryByTitle('Tour virtual do imóvel')).toBeNull();
    expect(screen.queryByText(/Construtora/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Dados do empreendimento' })).toBeNull();
    expect(screen.queryByText(/Pronto para morar/)).toBeNull();
  });
});
