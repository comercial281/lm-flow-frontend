import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaManutencao, { TEXTO_MANUTENCAO } from './PaginaManutencao';
import PortalHomePage from './PortalHomePage';
import PortalSearchPage from './PortalSearchPage';
import PortalArticlePage from './PortalArticlePage';
import PortalBlogPage from './PortalBlogPage';
import ImovelPublicPage from './ImovelPublicPage';
import type { SiteInfo } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Site em manutenção (Ativo ou Publicado desmarcado no Meu site). O servidor
   responde o /site com `maintenance: true` e só nome, marca, contato e título;
   as listas (imóveis, páginas, artigos) respondem 404. Página inicial, busca,
   blog e artigo viram a página Em manutenção; a ficha do imóvel continua
   abrindo, com topo e rodapé enxutos.
──────────────────────────────────────────────────────────────────────────── */

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const naoAchou = () => ({ ok: false, status: 404, json: async () => ({ success: false, error: 'Site em manutenção' }) });

const EM_MANUTENCAO: SiteInfo = {
  maintenance: true,
  name: 'Imob Teste',
  branding: { logo_url: null, favicon_url: 'https://cdn/icone.png', primary_color: '#123456' },
  contact: { whatsapp: '5511987654321', phone: '(11) 3333-4444', email: 'contato@imob.com.br' },
  seo: { title: null },
};

let chamadas: string[] = [];

/** Servidor em manutenção: /site reduzido, listas em 404, ficha do imóvel no ar. */
function servidor(site: SiteInfo, opcoes: { listaFalha?: boolean } = {}) {
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    chamadas.push(url);
    if (url.includes('/site/properties/C1')) return ok({ data: { code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', address_city: 'Campinas', photos: [] } });
    if (site.maintenance) {
      if (url.includes('/site/properties') && opcoes.listaFalha) throw new TypeError('Failed to fetch');
      if (/\/site\/(properties|articles|pages)/.test(url)) return naoAchou();
    } else {
      if (url.includes('/site/properties')) return ok({ data: [], meta: { total: 0 } });
      if (url.includes('/site/articles')) return ok({ data: [], meta: { total: 0 } });
    }
    if (/\/site(\?|$)/.test(url)) return ok({ data: site });
    return ok({});
  }));
}

function abrir(url: string, site: SiteInfo, opcoes?: { listaFalha?: boolean }) {
  servidor(site, opcoes);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/portal/:tenant" element={<PortalHomePage />} />
        <Route path="/portal/:tenant/imoveis" element={<PortalSearchPage />} />
        <Route path="/portal/:tenant/blog" element={<PortalBlogPage />} />
        <Route path="/portal/:tenant/blog/:slug" element={<PortalArticlePage />} />
        <Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');

beforeEach(() => { document.title = 'LM Flow'; });
afterEach(() => {
  // Desmonta antes de limpar o <head>: o React 19 põe lá a folha da fonte.
  cleanup();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('site em manutenção: as páginas viram a página Em manutenção', () => {
  it.each([
    ['página inicial', '/portal/imob'],
    ['busca', '/portal/imob/imoveis?tab=rent'],
    ['blog', '/portal/imob/blog'],
    ['artigo', '/portal/imob/blog/um-artigo'],
  ])('%s mostra a página de manutenção com WhatsApp, telefone e e-mail, mesmo com as listas em 404', async (_nome, url) => {
    abrir(url, EM_MANUTENCAO);

    expect(await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO })).toBeInTheDocument();
    expect(screen.getByText('Enquanto isso, fale com a gente:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Falar no WhatsApp/ }).getAttribute('href')).toBe('https://wa.me/5511987654321');
    expect(screen.getByRole('link', { name: /\(11\) 3333-4444/ }).getAttribute('href')).toBe('tel:1133334444');
    expect(screen.getByRole('link', { name: /contato@imob\.com\.br/ }).getAttribute('href')).toBe('mailto:contato@imob.com.br');
    expect(screen.getByText('Imob Teste')).toBeInTheDocument();

    expect(screen.queryByText('Portal indisponível.')).toBeNull();
    expect(screen.queryByText('Artigo não encontrado.')).toBeNull();
    expect(screen.queryByText('Nenhum artigo publicado ainda.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Comprar' })).toBeNull();
    expect(document.title).toBe('Imob Teste — Em manutenção');
  });

  it('falha de rede na lista de imóveis também não vira erro', async () => {
    abrir('/portal/imob', EM_MANUTENCAO, { listaFalha: true });
    expect(await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO })).toBeInTheDocument();
    expect(screen.queryByText('Portal indisponível.')).toBeNull();
  });

  it('só mostra o contato que existe', async () => {
    abrir('/portal/imob', { ...EM_MANUTENCAO, contact: { whatsapp: '5511987654321', phone: null, email: '' } });

    await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO });
    expect(screen.getByRole('link', { name: /Falar no WhatsApp/ })).toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('sem nenhum contato, nada de "Enquanto isso"', async () => {
    abrir('/portal/imob', { ...EM_MANUTENCAO, contact: {} });

    await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO });
    expect(screen.queryByText('Enquanto isso, fale com a gente:')).toBeNull();
  });

  it('com logo, mostra o logo no lugar do nome', async () => {
    abrir('/portal/imob', { ...EM_MANUTENCAO, branding: { ...EM_MANUTENCAO.branding, logo_url: 'https://cdn/logo.png' } });

    await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO });
    expect(screen.getByRole('img', { name: 'Imob Teste' }).getAttribute('src')).toBe('https://cdn/logo.png');
  });
});

describe('site no ar: nada muda', () => {
  it.each([
    ['sem o campo (servidor antigo)', {}],
    ['com maintenance false', { maintenance: false }],
  ])('%s: a página inicial abre normal', async (_nome, extra) => {
    abrir('/portal/imob', { name: 'Imob Teste', ...extra });

    expect(await screen.findByRole('heading', { level: 1, name: 'O imóvel certo pra sua próxima fase.' })).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MANUTENCAO)).toBeNull();
    expect(robots()?.content).toBe('index,follow');
  });

  it('sem o campo, a busca abre normal', async () => {
    abrir('/portal/imob/imoveis', { name: 'Imob Teste' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Encontre seu imóvel' })).toBeInTheDocument();
  });
});

describe('aba do navegador e Google', () => {
  it('título, noindex e ícone valem enquanto a página está aberta e voltam ao sair', () => {
    document.head.innerHTML = '<meta name="robots" content="index,follow"><link rel="icon" href="/favicon.ico">';
    document.title = 'LM Flow';
    const { unmount } = render(<PaginaManutencao site={EM_MANUTENCAO} />);

    expect(document.title).toBe('Imob Teste — Em manutenção');
    expect(robots()?.content).toBe('noindex');
    expect(document.head.querySelector('link[rel~="icon"]')?.getAttribute('href')).toBe('https://cdn/icone.png');

    unmount();
    expect(document.title).toBe('LM Flow');
    expect(robots()?.content).toBe('index,follow');
    expect(document.head.querySelector('link[rel~="icon"]')?.getAttribute('href')).toBe('/favicon.ico');
  });

  it('sem robots no <head>, cria o noindex e tira ao sair', () => {
    const { unmount } = render(<PaginaManutencao site={{ ...EM_MANUTENCAO, name: '' }} />);
    expect(document.title).toBe('Imóveis — Em manutenção');
    expect(robots()?.content).toBe('noindex');

    unmount();
    expect(robots()).toBeNull();
  });

  it('no site, a página inicial em manutenção fica com noindex', async () => {
    abrir('/portal/imob', EM_MANUTENCAO);
    await screen.findByRole('heading', { level: 1, name: TEXTO_MANUTENCAO });
    expect(robots()?.content).toBe('noindex');
  });
});

describe('ficha do imóvel em manutenção', () => {
  it('abre, com topo e rodapé só com logo e WhatsApp, sem lista e sem quebrar', async () => {
    abrir('/imovel/imob/C1', EM_MANUTENCAO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Casa no Cambuí' })).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MANUTENCAO)).toBeNull();

    // Topo e rodapé: o nome leva pra raiz do site (a página de manutenção).
    const raiz = screen.getAllByRole('link', { name: 'Imob Teste' });
    expect(raiz.length).toBe(2);
    raiz.forEach(l => expect(l.getAttribute('href')).toBe('/portal/imob'));
    const whatsapps = screen.getAllByRole('link', { name: /WhatsApp/ }).map(l => l.getAttribute('href'));
    expect(whatsapps).toContain('https://wa.me/5511987654321');

    // Sem abas, menu de páginas, blog, busca nem "voltar aos imóveis".
    for (const nome of ['Comprar', 'Alugar', 'Lançamentos', 'Blog', 'Sobre', 'Contato', 'Voltar aos imóveis']) {
      expect(screen.queryByRole('link', { name: nome })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(screen.queryByText('Você também pode gostar')).toBeNull();

    // A lista de imóveis e a de artigos nem são pedidas (dariam 404).
    expect(chamadas.some(u => /\/site\/properties\?/.test(u))).toBe(false);
    expect(chamadas.some(u => u.includes('/site/articles'))).toBe(false);

    // O formulário de contato da ficha continua lá.
    expect(screen.getAllByRole('button', { name: 'Tenho interesse' }).length).toBeGreaterThan(0);
  });

  it('no ar, a ficha segue com abas e o voltar aos imóveis', async () => {
    abrir('/imovel/imob/C1', { name: 'Imob Teste' });

    await screen.findByRole('heading', { level: 1, name: 'Casa no Cambuí' });
    expect(screen.getAllByRole('link', { name: 'Comprar' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Voltar aos imóveis/ })).toBeInTheDocument();
  });
});
