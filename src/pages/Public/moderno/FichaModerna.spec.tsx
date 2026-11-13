import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImovelPublicPage from '../ImovelPublicPage';
import type { SiteInfo } from '../portalShared';
import { esquecerModeloDaPrevia } from '@/features/siteBuilder/public/previaDoModelo';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Ficha do imóvel no Moderno: o mesmo contato do Clássico (corpo do envio,
   prévia sem envio, book só quando o Clássico mostra), a galeria em mosaico
   sem buraco e as seções que somem quando não há dado.
──────────────────────────────────────────────────────────────────────────── */

const resposta = (body: unknown) => ({ ok: true, json: async () => body });
const MODERNO: SiteInfo = { appearance: { style: 'modern' } } as SiteInfo;

const foto = (i: number) => ({ file_url: `https://cdn.exemplo.com/f${i}.jpg`, alt_text: `Foto ${i}` });
const fotos = (n: number) => Array.from({ length: n }, (_, i) => foto(i + 1));

export const REVENDA = {
  id: 'id-c1', code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', property_type: 'house', photos: fotos(3),
  sale_price: 500000, condo_fee: 800, iptu: 1200, useful_area_m2: 100, bedrooms: 3, suites: 1, parking_spaces: 2,
  address_neighborhood: 'Cambuí', address_city: 'Campinas', address_state: 'SP',
};
export const EMPREENDIMENTO = {
  ...REVENDA,
  title: 'Residencial Aurora', listing_kind: 'development', property_type: 'apartment',
  stage: 'in_construction', delivery_forecast: '2027-03-01', latitude: -22.9, longitude: -47.06,
  typologies: [{ name: 'Planta A', bedrooms: 2, useful_area_m2: 60, sale_price: 400000 }],
};

export async function abrirFicha(site: SiteInfo, imovel: Record<string, unknown> = {}, base: Record<string, unknown> = REVENDA) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes('/similar')) return resposta({ data: [] });
    if (url.endsWith('/site/leads')) return resposta({ data: { ok: true } });
    if (url.includes('/site/properties/C1')) return resposta({ data: { ...base, ...imovel } });
    if (url.includes('/site/properties')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', contact: { whatsapp: '11999990000' }, ...site } });
    return resposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  const tela = render(
    <MemoryRouter initialEntries={['/imovel/imob/C1']}>
      <Routes><Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: String(imovel.title ?? base.title) });
  return { fetchMock, tela };
}

/** Preenche e manda o "Tenho interesse"; devolve o lead que foi pro servidor. */
async function mandarInteresse(fetchMock: ReturnType<typeof vi.fn>) {
  const u = userEvent.setup();
  await u.type(screen.getAllByPlaceholderText('Seu nome')[0], 'Ana');
  await u.type(screen.getAllByPlaceholderText('Seu WhatsApp')[0], '11987654321');
  await u.click(screen.getAllByRole('button', { name: 'Tenho interesse' })[0]);
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/leads'))).toBe(true));
  const chamada = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/site/leads'))!;
  return JSON.parse(String((chamada[1] as RequestInit).body)).lead;
}

afterEach(() => {
  vi.unstubAllGlobals();
  esquecerModeloDaPrevia();
  window.history.replaceState({}, '', '/');
});

describe('Ficha no Moderno: contato', () => {
  it('desenha a ficha Moderna', async () => {
    await abrirFicha(MODERNO);
    expect(document.querySelector('[data-pagina-moderna="ficha"]')).not.toBeNull();
  });

  it('o "Tenho interesse" manda o mesmo corpo do Clássico', async () => {
    const classico = await abrirFicha({});
    const leadClassico = await mandarInteresse(classico.fetchMock);
    classico.tela.unmount();
    vi.unstubAllGlobals();

    const moderno = await abrirFicha(MODERNO);
    const leadModerno = await mandarInteresse(moderno.fetchMock);
    expect(leadModerno).toEqual(leadClassico);
    expect(leadModerno.form_type).toBe('imovel');
    expect(await screen.findAllByText('Recebemos seu interesse!')).not.toHaveLength(0);
  });

  it('prévia do modelo (?modelo=moderno): desenha o Moderno e não envia nada', async () => {
    window.history.replaceState({}, '', '/?modelo=moderno');
    const { fetchMock } = await abrirFicha({});
    expect(document.querySelector('[data-pagina-moderna="ficha"]')).not.toBeNull();
    const u = userEvent.setup();
    await u.type(screen.getAllByPlaceholderText('Seu nome')[0], 'Ana');
    await u.type(screen.getAllByPlaceholderText('Seu WhatsApp')[0], '11987654321');
    await u.click(screen.getAllByRole('button', { name: 'Tenho interesse' })[0]);
    expect(await screen.findAllByText(TEXTO_ENVIO_NA_PREVIA)).not.toHaveLength(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/leads'))).toBe(false);
  });

  it('"Receber o book no WhatsApp" só com a chave ligada, empreendimento e book', async () => {
    const LIGADO = { ...MODERNO, property_page: { development: { book_button: true } } } as SiteInfo;
    const a = await abrirFicha(LIGADO, { has_book: true }, EMPREENDIMENTO);
    expect(screen.getAllByRole('button', { name: 'Receber o book no WhatsApp' }).length).toBeGreaterThan(0);
    a.tela.unmount();
    const b = await abrirFicha(LIGADO, { has_book: true }, REVENDA);
    expect(screen.queryByRole('button', { name: 'Receber o book no WhatsApp' })).toBeNull();
    b.tela.unmount();
    await abrirFicha(MODERNO, { has_book: true }, EMPREENDIMENTO);
    expect(screen.queryByRole('button', { name: 'Receber o book no WhatsApp' })).toBeNull();
  });

  it('pedido do book manda imovel_book e confirma', async () => {
    const LIGADO = { ...MODERNO, property_page: { development: { book_button: true } } } as SiteInfo;
    const { fetchMock } = await abrirFicha(LIGADO, { has_book: true }, EMPREENDIMENTO);
    const u = userEvent.setup();
    await u.click(screen.getAllByRole('button', { name: 'Receber o book no WhatsApp' })[0]);
    await u.type(screen.getAllByPlaceholderText('Seu nome')[0], 'Ana');
    await u.type(screen.getAllByPlaceholderText('Seu WhatsApp')[0], '11987654321');
    await u.click(screen.getAllByRole('button', { name: 'Receber o book' })[0]);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/leads'))).toBe(true));
    const chamada = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/site/leads'))!;
    expect(JSON.parse(String((chamada[1] as RequestInit).body)).lead.form_type).toBe('imovel_book');
    expect((await screen.findAllByText('Pronto! O book vai chegar no seu WhatsApp em alguns minutos.')).length).toBeGreaterThan(0);
  });

  it('lançamento: preço "a partir de", código com CRECI e fase', async () => {
    await abrirFicha({ ...MODERNO, creci: 'J-34.512' } as SiteInfo, {}, EMPREENDIMENTO);
    const cartao = screen.getAllByTestId('cartao-de-interesse')[0];
    expect(within(cartao).getByText('a partir de')).toBeTruthy();
    expect(within(cartao).getByText('Código C1 · CRECI J-34.512')).toBeTruthy();
    expect(within(cartao).getAllByText(/Em obra/)[0]).toBeTruthy();
  });
});

describe('Ficha no Moderno: galeria em mosaico', () => {
  const tiles = () => screen.queryAllByRole('button', { name: /^Ver foto \d+/ });

  it('sem foto: sem galeria', async () => {
    await abrirFicha(MODERNO, { photos: [] });
    expect(tiles()).toHaveLength(0);
  });

  it('1 foto: uma foto larga', async () => {
    await abrirFicha(MODERNO, { photos: fotos(1) });
    expect(tiles()).toHaveLength(1);
    expect(screen.getByTestId('mosaico').getAttribute('data-fotos')).toBe('1');
  });

  it('3 fotos: as 3, sem "+N"', async () => {
    await abrirFicha(MODERNO, { photos: fotos(3) });
    expect(tiles()).toHaveLength(3);
    expect(screen.queryByText(/^\+\d+ fotos$/)).toBeNull();
  });

  it('8 fotos: 1 grande + 4, a última com "+3 fotos"; clicar abre a tela cheia na foto', async () => {
    await abrirFicha(MODERNO, { photos: fotos(8) });
    expect(tiles()).toHaveLength(5);
    expect(screen.getByText('+3 fotos')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: /^Ver foto 5/ }));
    const galeria = screen.getByRole('dialog', { name: 'Galeria de fotos' });
    expect(within(galeria).getByText('5 / 8')).toBeTruthy();
  });

  it('com vídeo e tour: os atalhos na foto grande', async () => {
    await abrirFicha(MODERNO, { video_url: 'https://www.youtube.com/watch?v=abcdefghijk', virtual_tour_url: 'https://my.matterport.com/show/?m=abc123' });
    expect(screen.getByRole('link', { name: 'Ver vídeo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tour virtual' })).toBeTruthy();
  });
});

describe('Ficha no Moderno: conteúdo', () => {
  const titulo = (nome: string) => screen.queryByRole('heading', { level: 2, name: nome });

  it('revenda sem dados extras: só o que existe, sem título solto', async () => {
    await abrirFicha(MODERNO, { description: '' });
    for (const nome of ['Sobre o imóvel', 'Tipologias disponíveis', 'Características', 'Comodidades do condomínio', 'Dados do empreendimento', 'Vídeo e tour virtual']) {
      expect(titulo(nome)).toBeNull();
    }
    // Revenda: o mapa da região (sem pino).
    expect(titulo('Localização')).toBeTruthy();
    expect(screen.getByTitle('Mapa da região')).toBeTruthy();
  });

  it('Sobre o imóvel em parágrafos, com negrito', async () => {
    await abrirFicha(MODERNO, { description: 'Casa **reformada**.\n\nPerto do metrô.' });
    const sobre = titulo('Sobre o imóvel')!.closest('section')!;
    expect(sobre.querySelectorAll('p')).toHaveLength(2);
    expect(within(sobre).getByText('reformada').tagName).toBe('STRONG');
  });

  it('características e comodidades em lista', async () => {
    await abrirFicha(MODERNO, { features: ['piscina'], condo_features: ['portaria_24h'] });
    expect(titulo('Características')).toBeTruthy();
    expect(titulo('Comodidades do condomínio')).toBeTruthy();
  });

  it('lançamento: dados do empreendimento, tipologias em tabela, mapa exato e o bloco do book', async () => {
    const LIGADO = { ...MODERNO, property_page: { development: { book_button: true } } } as SiteInfo;
    await abrirFicha(LIGADO, { has_book: true, towers: 2 }, EMPREENDIMENTO);
    expect(titulo('Dados do empreendimento')).toBeTruthy();
    const tipologias = titulo('Tipologias disponíveis')!.closest('section')!;
    expect(within(tipologias).getByRole('table')).toBeTruthy();
    expect(within(tipologias).getByText('Planta A')).toBeTruthy();
    expect(screen.getByTitle('Mapa do empreendimento')).toBeTruthy();
    const bloco = screen.getByTestId('bloco-do-book');
    await userEvent.setup().click(within(bloco).getByRole('button', { name: 'Receber o book no WhatsApp' }));
    expect(screen.getAllByText('Receba o book no WhatsApp').length).toBeGreaterThan(1);
  });

  it('Página do imóvel desligando mapa e tipologias: o Moderno respeita', async () => {
    await abrirFicha({ ...MODERNO, property_page: { development: { typologies: false, map: false } } } as SiteInfo, {}, EMPREENDIMENTO);
    expect(titulo('Tipologias disponíveis')).toBeNull();
    expect(titulo('Localização')).toBeNull();
  });

  it('vídeo: seção própria, alvo do "Ver vídeo"', async () => {
    await abrirFicha(MODERNO, { video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    const secao = titulo('Vídeo e tour virtual')!.closest('section')!;
    expect(secao.id).toBe('video-e-tour');
    expect(within(secao).getByTitle('Vídeo do imóvel')).toBeTruthy();
  });

  it('"Você também pode gostar" com o cartão claro', async () => {
    vi.unstubAllGlobals();
    const parecido = { id: 'p2', code: 'C2', title: 'Apartamento parecido', transaction_type: 'sale', property_type: 'apartment', address: { city: 'Campinas' } };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/similar')) return resposta({ data: [parecido] });
      if (url.includes('/site/properties/C1')) return resposta({ data: REVENDA });
      if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob', ...MODERNO } });
      return resposta({});
    }));
    render(
      <MemoryRouter initialEntries={['/imovel/imob/C1']}>
        <Routes><Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Você também pode gostar' })).toBeTruthy();
    expect(screen.getByText('Apartamento · C2')).toBeTruthy();
  });

  it('celular: a barra fixa de contato continua (WhatsApp)', async () => {
    await abrirFicha(MODERNO);
    const barra = screen.getByTestId('barra-de-contato');
    expect(barra.className).toContain('lg:hidden');
    expect(barra.className).toContain('fixed');
    expect(within(barra).getByRole('link', { name: /WhatsApp/ })).toBeTruthy();
  });

  it('celular sem WhatsApp do site: a barra leva ao cartão de interesse', async () => {
    await abrirFicha({ ...MODERNO, contact: {} } as SiteInfo);
    const barra = screen.getByTestId('barra-de-contato');
    expect(within(barra).getByRole('link', { name: 'Tenho interesse' }).getAttribute('href')).toBe('#contato');
  });
});

describe('Ficha no Moderno: alvos de rolagem', () => {
  it('o cartão do celular e a seção de vídeo não ficam embaixo do topo grudado', async () => {
    await abrirFicha(MODERNO, { video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect(document.getElementById('contato')!.className).toContain('scroll-mt-[140px]');
    expect(document.getElementById('video-e-tour')!.className).toContain('scroll-mt-[140px]');
  });
});

describe('Ficha no Moderno: achados da revisão', () => {
  it('vídeo sozinho ocupa a coluna (sem o teto do Clássico, que conta a página inteira)', async () => {
    await abrirFicha(MODERNO, { video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    const player = screen.getByTitle('Vídeo do imóvel').parentElement!;
    expect(player.className).not.toContain('max-w-[calc(100%-400px)]');
  });

  it('faixa de números sem célula vazia: a última linha estica (flex-wrap)', async () => {
    await abrirFicha(MODERNO, { bathrooms: 2 });
    const faixa = screen.getByText('dormitórios').closest('dl')!;
    expect(faixa.className).toContain('flex-wrap');
    expect(faixa.className).not.toContain('grid-cols');
    for (const cel of Array.from(faixa.children)) expect(cel.className).toContain('flex-1');
  });
});
