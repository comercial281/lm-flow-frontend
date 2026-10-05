import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalFooter, PortalHeader, type SiteInfo } from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Meu site › Menus no site público (C3, Task 9): o topo segue o menu (ordem,
   nome, liga/desliga, externos) e o rodapé repete o menu depois que o cliente
   mexe nele. Menu de fábrica / servidor velho = o de antes (conferido nos
   fixtures, em molduraAntesDoC3.spec.tsx).
──────────────────────────────────────────────────────────────────────────── */

const fixo = (key: string, extra: object = {}) => ({ key, label: null, enabled: true, ...extra });
const FABRICA = ['sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing', 'blog'].map(k => fixo(k));
const PAGINA = fixo('page:quem-somos', { page_title: 'Quem somos' });
const comPagina = (itens: object[]) => [...itens.slice(0, 7), PAGINA, ...itens.slice(7)];

const base: SiteInfo = {
  name: 'Imob Teste',
  contact: { whatsapp: '5511999990000' },
  financiamento: { enabled: true }, anuncie: { enabled: true },
  menu: [{ title: 'Quem somos', slug: 'quem-somos' }],
};
/** Menu mexido: Blog renomeado e primeiro, Alugar desligado, Sobre renomeado, um externo. */
const MEXIDO = {
  items: [
    fixo('blog', { label: 'Notícias' }), fixo('sale'), fixo('rent', { enabled: false }), fixo('launch'),
    fixo('about', { label: 'Quem é a Imob' }), fixo('contact'), fixo('financing'), fixo('listing'), PAGINA,
  ],
  external: [{ label: 'CRECI', url: 'https://creci.org.br' }, { label: 'Ruim', url: 'javascript:alert(1)' }],
};

let artigos = 0;
async function montar(el: React.ReactElement) {
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<MemoryRouter>{el}</MemoryRouter>); });
  return out.container;
}
const navDoTopo = (c: HTMLElement) => [...c.querySelectorAll('header nav a')].map(a => a.textContent);
const coluna = (c: HTMLElement, titulo: string) => {
  const h = [...c.querySelectorAll('footer h4')].find(x => x.textContent === titulo);
  return h ? [...h.parentElement!.querySelectorAll('a')].map(a => a.textContent) : null;
};

beforeEach(() => {
  artigos = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ data: [], meta: { total: artigos } }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('topo', () => {
  it('fábrica = os itens de hoje, na ordem de hoje', async () => {
    artigos = 1;
    const c = await montar(<PortalHeader site={{ ...base, menu_config: { items: comPagina(FABRICA), external: [] } }} tenant="imob" />);
    expect(navDoTopo(c)).toEqual(['Comprar', 'Alugar', 'Lançamentos', 'Sobre', 'Contato', 'Financiamento', 'Anuncie seu imóvel', 'Quem somos', 'Blog']);
  });

  it('segue a ordem, o nome e o liga/desliga do menu; o externo abre em outra aba', async () => {
    artigos = 1;
    const c = await montar(<PortalHeader site={{ ...base, menu_config: MEXIDO }} tenant="imob" />);
    expect(navDoTopo(c)).toEqual(['Notícias', 'Comprar', 'Lançamentos', 'Quem é a Imob', 'Contato', 'Financiamento', 'Anuncie seu imóvel', 'Quem somos', 'CRECI']);
    const creci = within(c.querySelector('header nav')!).getByText('CRECI');
    expect(creci.getAttribute('href')).toBe('https://creci.org.br/');
    expect(creci.getAttribute('target')).toBe('_blank');
    expect(creci.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(c.querySelector('header nav')!).getByText('Notícias').getAttribute('href')).toBe('/portal/imob/blog');
  });

  it('blog sem artigo some, mesmo ligado e renomeado', async () => {
    const c = await montar(<PortalHeader site={{ ...base, menu_config: MEXIDO }} tenant="imob" />);
    expect(navDoTopo(c)).not.toContain('Notícias');
  });

  it('o menu do celular mostra os mesmos itens', async () => {
    artigos = 1;
    const c = await montar(<PortalHeader site={{ ...base, menu_config: MEXIDO }} tenant="imob" />);
    act(() => { fireEvent.click(c.querySelector('button[aria-label="Menu"]')!); });
    const celular = c.querySelectorAll('header nav')[1];
    expect([...celular.querySelectorAll('a')].map(a => a.textContent)).toEqual(navDoTopo(c).slice(0, 9));
  });

  it('em manutenção o topo e o rodapé enxutos não mostram menu', async () => {
    const site = { ...base, maintenance: true, menu_config: MEXIDO };
    const t = await montar(<PortalHeader site={site} tenant="imob" />);
    expect(t.querySelector('nav')).toBeNull();
    expect(t.textContent).not.toContain('CRECI');
    cleanup();
    const r = await montar(<PortalFooter site={site} tenant="imob" />);
    expect(r.querySelector('nav')).toBeNull();
    expect(r.textContent).not.toContain('CRECI');
  });
});

describe('rodapé', () => {
  it('menu de fábrica: o rodapé de antes (sem as páginas criadas)', async () => {
    const c = await montar(<PortalFooter site={{ ...base, menu_config: { items: comPagina(FABRICA), external: [] } }} tenant="imob" />);
    expect(coluna(c, 'Imóveis')).toEqual(['Comprar', 'Alugar', 'Lançamentos']);
    expect(coluna(c, 'Institucional')).toEqual(['Sobre nós', 'Contato', 'Anuncie seu imóvel', 'Financiamento']);
  });

  it('menu mexido: a coluna Institucional vira o menu, com a página criada e o externo', async () => {
    artigos = 1;
    const c = await montar(<PortalFooter site={{ ...base, menu_config: MEXIDO }} tenant="imob" />);
    expect(coluna(c, 'Imóveis')).toEqual(['Comprar', 'Lançamentos']);
    expect(coluna(c, 'Institucional')).toEqual(['Notícias', 'Quem é a Imob', 'Contato', 'Financiamento', 'Anuncie seu imóvel', 'Quem somos', 'CRECI']);
    const pagina = within(c.querySelector('footer')!).getByText('Quem somos');
    expect(pagina.getAttribute('href')).toBe('/portal/imob/p/quem-somos');
    const creci = within(c.querySelector('footer')!).getByText('CRECI');
    expect([creci.getAttribute('target'), creci.getAttribute('rel')]).toEqual(['_blank', 'noopener noreferrer']);
  });

  it('página criada aparece no rodapé assim que o menu é mexido', async () => {
    const menu = { items: comPagina(FABRICA).map(i => (i.key === 'contact' ? { ...i, label: 'Fale conosco' } : i)), external: [] };
    const c = await montar(<PortalFooter site={{ ...base, menu_config: menu }} tenant="imob" />);
    expect(coluna(c, 'Institucional')).toContain('Quem somos');
    expect(coluna(c, 'Institucional')).toContain('Fale conosco');
  });

  it('blog sem artigo some do rodapé', async () => {
    const c = await montar(<PortalFooter site={{ ...base, menu_config: MEXIDO }} tenant="imob" />);
    expect(coluna(c, 'Institucional')).not.toContain('Notícias');
  });

  it('compacto: o menu inteiro na ordem dele', async () => {
    artigos = 1;
    const site: SiteInfo = { ...base, menu_config: MEXIDO, appearance: { footer_layout: 'compact' } };
    const c = await montar(<PortalFooter site={site} tenant="imob" />);
    const links = [...c.querySelectorAll('footer nav a')].map(a => a.textContent);
    expect(links).toEqual(['Notícias', 'Comprar', 'Lançamentos', 'Quem é a Imob', 'Contato', 'Financiamento', 'Anuncie seu imóvel', 'Quem somos', 'CRECI']);
  });

  it('menu mexido sem nada institucional: a coluna vazia não aparece', async () => {
    const items = FABRICA.map(i => (['sale', 'rent', 'launch'].includes(i.key) ? { ...i, label: `${i.key}!` } : { ...i, enabled: false }));
    const c = await montar(<PortalFooter site={{ ...base, menu: [], menu_config: { items, external: [] } }} tenant="imob" />);
    expect(coluna(c, 'Imóveis')).toEqual(['sale!', 'rent!', 'launch!']);
    expect(coluna(c, 'Institucional')).toBeNull();
  });
});
