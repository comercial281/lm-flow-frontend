import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalProperty, SiteInfo } from '@/pages/Public/portalShared';
import { esquecerDominio } from '@/features/siteBuilder/public/dominioDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   O site no domínio do cliente: só as páginas do site, em caminhos limpos, e
   nada do CRM. Os módulos de sessão e de websocket são trocados por espiões que
   ANOTAM se chegaram a ser importados: o roteador do domínio não pode puxá-los,
   nem de longe (página pública que importasse o store de sessão faria o
   domínio do cliente ler o token do CRM).
──────────────────────────────────────────────────────────────────────────── */

const crm = vi.hoisted(() => ({
  importados: [] as string[],
  useAuthStore: vi.fn(),
  readSessionToken: vi.fn(() => null),
  validityCheck: vi.fn(),
  useWebSocket: vi.fn(),
}));

vi.mock('@/store/authStore', () => {
  crm.importados.push('authStore');
  const store = Object.assign(crm.useAuthStore, { getState: () => ({ validityCheck: crm.validityCheck }) });
  return { useAuthStore: store, default: store };
});
vi.mock('@/features/auth/sessionPersistence', () => {
  crm.importados.push('sessionPersistence');
  return { readSessionToken: crm.readSessionToken, TOKEN_KEY: 'access_token' };
});
vi.mock('@/contexts/AuthContext', () => {
  crm.importados.push('AuthContext');
  return { AuthProvider: ({ children }: { children: unknown }) => children, useAuth: vi.fn() };
});
vi.mock('@/hooks/chat/useWebSocket', () => {
  crm.importados.push('useWebSocket');
  return { useWebSocket: crm.useWebSocket, default: crm.useWebSocket };
});

import SiteDoDominioApp, { RotasDoSite } from './SiteDoDominio';

const SITE = { tenant: 'imob', slug: 'imob', host: 'www.imob.com.br' };

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});

const resposta = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
let chamadas: { url: string; tenant?: string }[] = [];

function servidor(site: SiteInfo = {}, items: PortalProperty[] = [imovel('R1', { featured: true })]) {
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    chamadas.push({ url, tenant: (init?.headers as Record<string, string> | undefined)?.['X-Tenant'] });
    if (url.includes('/resolve')) return resposta({}, 404);
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [{ id: '1', title: 'A', slug: 'a' }], meta: { total: 1 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', financiamento: { enabled: true }, anuncie: { enabled: true },
      menu: [{ title: 'Sobre nós', slug: 'sobre' }], contact: { whatsapp: '5511999990000' }, ...site } });
    return resposta({});
  }));
}

function Onde() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="onde">{`${pathname}${search}${hash}`}</output>;
}

function abrir(caminho: string) {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <RotasDoSite site={SITE} />
      <Onde />
    </MemoryRouter>,
  );
}

const onde = () => screen.getByTestId('onde').textContent;
let getItem: ReturnType<typeof vi.spyOn>;

// As páginas do site são carregadas sob demanda: aquece aqui pra a primeira
// abertura não estourar o tempo de espera do findBy. Se alguma delas puxasse o
// CRM, o espião acima anotaria do mesmo jeito.
beforeAll(async () => {
  await Promise.all([
    import('@/pages/Public/PortalHomePage'), import('@/pages/Public/PortalSearchPage'),
    import('@/pages/Public/ImovelPublicPage'), import('@/pages/Public/PortalBlogPage'),
    import('@/pages/Public/PortalArticlePage'), import('@/pages/Public/PortalCustomPage'),
    import('@/pages/Public/PortalFinanciamentoPage'), import('@/pages/Public/PortalAnunciePage'),
    import('@/features/landing/public/LandingPublicView'), import('@/features/landing/public/LandingResultView'),
  ]);
}, 30_000);

beforeEach(() => {
  getItem = vi.spyOn(Storage.prototype, 'getItem');
  servidor();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  getItem.mockRestore();
  esquecerDominio();
});

/** Nada do CRM: nem importado, nem chamado, nem o token lido. */
function semNadaDoCrm() {
  expect(crm.importados).toEqual([]);
  expect(crm.useAuthStore).not.toHaveBeenCalled();
  expect(crm.readSessionToken).not.toHaveBeenCalled();
  expect(crm.validityCheck).not.toHaveBeenCalled();
  expect(crm.useWebSocket).not.toHaveBeenCalled();
  expect(getItem.mock.calls.some(([k]) => k === 'access_token')).toBe(false);
}

describe('roteador do domínio do cliente', () => {
  it.each(['/login', '/conversas', '/settings/x', '/dashboard', '/admin/clientes'])(
    'tela do CRM (%s) cai no início do site, sem tocar na sessão', async caminho => {
      abrir(caminho);
      await screen.findByRole('heading', { level: 1 });
      expect(onde()).toBe('/');
      semNadaDoCrm();
    },
  );

  it('/portal/<cliente>/imoveis vai para /imoveis, com a busca', async () => {
    abrir('/portal/imob/imoveis?tab=rent&city=Campinas');
    await waitFor(() => expect(onde()).toBe('/imoveis?tab=rent&city=Campinas'));
  });

  it('/portal/<cliente> vai para o início, e /portal/<cliente>/blog para /blog', async () => {
    abrir('/portal/imob');
    await waitFor(() => expect(onde()).toBe('/'));
    cleanup();
    abrir('/portal/imob/blog');
    await waitFor(() => expect(onde()).toBe('/blog'));
  });

  it('/imovel/<cliente>/<código> vai para /imovel/<código>', async () => {
    abrir('/imovel/imob/AP0042?finalidade=locacao');
    await waitFor(() => expect(onde()).toBe('/imovel/AP0042?finalidade=locacao'));
  });

  it('/lp/<cliente>/<slug> vai para /lp/<slug>', async () => {
    abrir('/lp/imob/oferta');
    await waitFor(() => expect(onde()).toBe('/lp/oferta'));
  });

  it('as chamadas ao servidor levam o cliente do domínio no X-Tenant', async () => {
    abrir('/imoveis');
    await waitFor(() => expect(chamadas.some(c => /\/site$/.test(c.url))).toBe(true));
    expect(chamadas.filter(c => c.url.includes('/api/public/v1/site')).every(c => c.tenant === 'imob')).toBe(true);
  });

  it('a home no domínio monta só links limpos (cartões, menu, rodapé, vitrine, chamadas, logo, blog)', async () => {
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    await screen.findAllByRole('link', { name: 'Blog' });
    const hrefs = Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')!);
    const internos = hrefs.filter(h => h.startsWith('/'));
    expect(internos.length).toBeGreaterThan(0);
    expect(internos.filter(h => h.startsWith('/portal/') || h.startsWith('/imovel/imob/'))).toEqual([]);
    expect(internos).toEqual(expect.arrayContaining([
      '/imovel/R1', '/imoveis?tab=sale', '/blog', '/p/sobre', '/financiamento', '/anuncie',
    ]));
    semNadaDoCrm();
  });

  it('a ficha do imóvel no domínio: "Voltar aos imóveis" vai para o início limpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/site/properties/AP1')) return resposta({ data: { code: 'AP1', title: 'Casa AP1', photos: [] } });
      if (url.includes('/site/properties')) return resposta({ data: [], meta: { total: 0 } });
      if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
      if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste' } });
      return resposta({});
    }));
    abrir('/imovel/AP1');
    const voltar = await screen.findByRole('link', { name: /Voltar aos imóveis/ });
    expect(voltar.getAttribute('href')).toBe('/');
  });
});

describe('domínio não resolvido', () => {
  it('404 do resolve mostra "Site não encontrado", nunca o login', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'www.sem-site.com.br' });
    render(<SiteDoDominioApp />);
    expect(await screen.findByRole('heading', { name: 'Site não encontrado' })).toBeInTheDocument();
    expect(chamadas.map(c => c.url)).toEqual([expect.stringContaining('/api/public/v1/resolve?host=www.sem-site.com.br')]);
    expect(screen.queryByText(/entrar|senha/i)).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    semNadaDoCrm();
  });
});
