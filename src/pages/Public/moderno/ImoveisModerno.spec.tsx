import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalSearchPage from '../PortalSearchPage';
import type { PortalProperty } from '../portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Página de Imóveis no Moderno: a mesma busca do Clássico (filtros na URL,
   ordem, "Mostrar mais"), com o painel de filtros, as pílulas dos filtros
   ativos e o cartão claro.
──────────────────────────────────────────────────────────────────────────── */

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const resposta = (body: unknown) => ({ ok: true, json: async () => body });

function SondaDaUrl() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}
const urlAtual = () => new URLSearchParams(screen.getByTestId('url').textContent ?? '');

async function abrir(items: PortalProperty[], url = '/portal/imob/imoveis', aparencia: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    if (u.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (u.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(u)) return resposta({ data: { name: 'Imob', appearance: { style: 'modern', ...aparencia }, ...extra } });
    return resposta({});
  }));
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/portal/:tenant/imoveis" element={<PortalSearchPage />} /></Routes>
      <SondaDaUrl />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Encontre seu imóvel' });
}
const lista = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLSelectElement;

afterEach(() => { vi.unstubAllGlobals(); });

describe('Imóveis no Moderno', () => {
  it('desenha o Moderno (cartão claro), não o do Clássico', async () => {
    await abrir([imovel('A1'), imovel('A2')]);
    expect(document.querySelector('[data-pagina-moderna="imoveis"]')).not.toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Apartamento · A1')).toBeTruthy();
  });

  it('as escolhas vão pra URL igual ao Clássico', async () => {
    await abrir([imovel('A1', { icon_summary: { bedrooms: 3 } }), imovel('C1', { property_type: 'house', address: { city: 'Sorocaba', neighborhood: 'Jardim' } })]);
    fireEvent.change(lista('Tipo'), { target: { value: 'apartment' } });
    fireEvent.change(lista('Cidade'), { target: { value: 'Campinas' } });
    fireEvent.change(lista('Dormitórios'), { target: { value: '2' } });
    const url = urlAtual();
    expect(url.get('type')).toBe('apartment');
    expect(url.get('city')).toBe('Campinas');
    expect(url.get('bedrooms')).toBe('2');
  });

  it('cada pílula de filtro ativo tira só o filtro dela', async () => {
    await abrir([imovel('A1', { icon_summary: { bedrooms: 3 } })], '/portal/imob/imoveis?city=Campinas&bedrooms=2&price_min=300000&price_max=600000');
    const pilulas = screen.getByRole('list', { name: 'Filtros ativos' });
    expect(within(pilulas).getByText('2+ dormitórios')).toBeTruthy();
    fireEvent.click(within(pilulas).getByRole('button', { name: 'Tirar o filtro Campinas' }));
    expect(urlAtual().get('city')).toBeNull();
    expect(urlAtual().get('bedrooms')).toBe('2');
    const preco = within(pilulas).getAllByRole('button').find(b => /R\$/.test(b.getAttribute('aria-label') ?? ''))!;
    fireEvent.click(preco);
    expect(urlAtual().get('price_min')).toBeNull();
    expect(urlAtual().get('price_max')).toBeNull();
    expect(urlAtual().get('bedrooms')).toBe('2');
  });

  it('"Mais filtros" abre e fecha Suítes, Vagas e Fase (Fase some em Alugar)', async () => {
    await abrir([imovel('A1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000 })]);
    expect(screen.queryByLabelText('Suítes')).toBeNull();
    const botao = screen.getByRole('button', { name: 'Mais filtros' });
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Suítes')).toBeTruthy();
    expect(screen.getByLabelText('Vagas')).toBeTruthy();
    expect(screen.getByLabelText('Fase')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alugar' }));
    expect(screen.queryByLabelText('Fase')).toBeNull();
    fireEvent.click(botao);
    expect(screen.queryByLabelText('Suítes')).toBeNull();
  });

  it('"Mais filtros" já vem aberto quando um deles está na URL', async () => {
    await abrir([imovel('A1')], '/portal/imob/imoveis?suites=2');
    expect(screen.getByLabelText('Suítes')).toBeTruthy();
  });

  it('uma caixa de texto só: o código digitado no campo de lugar + Enter vai pra URL como code', async () => {
    await abrir([imovel('A1'), imovel('A2')]);
    expect(screen.queryByPlaceholderText(/Código do imóvel/i)).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    const caixa = screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' }) as HTMLInputElement;
    expect(caixa.getAttribute('placeholder')).toBe('Digite condomínio, bairro, cidade ou código');
    fireEvent.change(caixa, { target: { value: 'a1' } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(urlAtual().get('code')).toBe('a1');
    expect(urlAtual().get('place')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('texto que não é código + Enter vai como place', async () => {
    await abrir([imovel('A1')]);
    const caixa = screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' });
    fireEvent.change(caixa, { target: { value: 'Campinas' } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(urlAtual().get('place')).toBe('Campinas');
    expect(urlAtual().get('code')).toBeNull();
  });

  it('?code=AP0632 ao abrir: o campo mostra o código e o × tira', async () => {
    await abrir([imovel('AP0632'), imovel('A2')], '/portal/imob/imoveis?code=AP0632');
    const caixa = screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' }) as HTMLInputElement;
    expect(caixa.value).toBe('AP0632');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar condomínio, bairro ou cidade' }));
    expect(urlAtual().get('code')).toBeNull();
    expect(caixa.value).toBe('');
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('em linhas: cartão claro deitado', async () => {
    await abrir([imovel('A1'), imovel('A2')], '/portal/imob/imoveis', {}, { listing: { card_layout: 'rows' } });
    expect(screen.getAllByRole('article')[0].className).toContain('md:grid-cols-');
  });

  it('contagem, "Mostrar mais" de 30 em 30 e ordenação', async () => {
    const muitos = Array.from({ length: 35 }, (_, i) => imovel(`M${i + 1}`));
    await abrir(muitos);
    expect(screen.getByRole('heading', { level: 2, name: '35 imóveis encontrados' })).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(30);
    expect(screen.getByText('Mostrando 30 de 35')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais imóveis' }));
    expect(screen.getAllByRole('article')).toHaveLength(35);
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'price_asc' } });
    expect(urlAtual().get('sort')).toBe('price_asc');
  });

  it('sem resultado: a mensagem de hoje com "Limpar filtros"', async () => {
    await abrir([imovel('A1')], '/portal/imob/imoveis?code=ZZZ');
    expect(screen.getByText(/Nenhum imóvel com esses filtros/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(urlAtual().get('code')).toBeNull();
  });
});

describe('Imóveis no Moderno: lista de opções no fundo escuro', () => {
  it('as opções têm fundo branco próprio (o color-scheme escuro não deixa o texto escuro sobre escuro)', async () => {
    await abrir([imovel('A1'), imovel('A2')]);
    expect(lista('Tipo').className).toContain('[&_option]:bg-[#FFFFFF]');
    expect((screen.getByLabelText('Ordenar por') as HTMLSelectElement).className).toContain('[&_option]:bg-[#FFFFFF]');
  });
});

describe('Imóveis no Moderno: condomínio, bairro ou cidade e Área', () => {
  const base = () => [
    imovel('C1', { condominium_name: 'Collina Parque dos Príncipes', icon_summary: { useful_area_m2: 120 } }),
    imovel('C2', { address: { city: 'Cotia', neighborhood: 'Granja' }, icon_summary: { useful_area_m2: 60 } }),
  ];
  const campo = () => screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' }) as HTMLInputElement;
  const titulosDosCartoes = () => screen.queryAllByRole('article').length;

  it('vindo da capa com ?place=co: o campo mostra o texto, a pílula aparece e o × tira', async () => {
    await abrir(base(), '/portal/imob/imoveis?place=co');
    expect(campo().value).toBe('co');
    expect(titulosDosCartoes()).toBe(2);
    expect(within(screen.getByRole('list', { name: 'Filtros ativos' })).getByText('“co”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar condomínio, bairro ou cidade' }));
    expect(urlAtual().get('place')).toBeNull();
    expect(campo().value).toBe('');
  });

  it('vindo da capa com ?condominium=…: o campo mostra o nome, filtra, e a pílula tira', async () => {
    await abrir(base(), '/portal/imob/imoveis?condominium=Collina%20Parque%20dos%20Pr%C3%ADncipes');
    expect(campo().value).toBe('Collina Parque dos Príncipes');
    expect(titulosDosCartoes()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar o filtro Condomínio Collina Parque dos Príncipes' }));
    expect(urlAtual().get('condominium')).toBeNull();
    expect(campo().value).toBe('');
    expect(titulosDosCartoes()).toBe(2);
  });

  it('escolher uma sugestão no painel grava o condomínio na URL', async () => {
    await abrir(base());
    fireEvent.change(campo(), { target: { value: 'colli' } });
    fireEvent.click(await screen.findByRole('option', { name: /Collina Parque dos Príncipes/ }));
    expect(urlAtual().get('condominium')).toBe('Collina Parque dos Príncipes');
    expect(titulosDosCartoes()).toBe(1);
  });

  it('Área fica no Mais filtros, abre sozinho com ?area= e vira pílula', async () => {
    await abrir(base());
    expect(screen.queryByLabelText('Área')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Mais filtros/ }));
    fireEvent.change(lista('Área'), { target: { value: '100' } });
    expect(urlAtual().get('area')).toBe('100');
    expect(titulosDosCartoes()).toBe(1);
    expect(within(screen.getByRole('list', { name: 'Filtros ativos' })).getByText('100 m²+')).toBeTruthy();
  });

  it('?area= abre o Mais filtros com a Área marcada', async () => {
    await abrir(base(), '/portal/imob/imoveis?area=100');
    expect(lista('Área').value).toBe('100');
  });
});
