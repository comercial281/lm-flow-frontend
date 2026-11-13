import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalFinanciamentoPage from '../PortalFinanciamentoPage';
import type { SiteInfo } from '../portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn(), trackLead: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Páginas do Moderno, parte (c): Financiamento, Anuncie, Blog, Artigo, página
   própria, 404 da lista e manutenção. Os dados e envios são os do Clássico;
   aqui confere o desenho escolhido e o que a pessoa lê e clica.
──────────────────────────────────────────────────────────────────────────── */

const resposta = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body });
export const MODERNO = { appearance: { style: 'modern' } } as SiteInfo;

type Rota = { caminho: string; padrao: string; elemento: ReactElement };
type Extra = (url: string, init?: RequestInit) => ReturnType<typeof resposta> | null;

export async function abrir(rota: Rota, site: SiteInfo, extra: Extra = () => null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const e = extra(url, init);
    if (e) return e;
    if (url.includes('/site/properties')) return resposta({ data: [], meta: { total: 0 } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', contact: { whatsapp: '11999990000' }, ...site } });
    return resposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  const tela = render(
    <MemoryRouter initialEntries={[rota.caminho]}>
      <Routes><Route path={rota.padrao} element={rota.elemento} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector('[data-carregando]')).toBeNull());
  return { fetchMock, tela };
}

const paginaModerna = (nome: string) => document.querySelector(`[data-pagina-moderna="${nome}"]`);

afterEach(() => { vi.unstubAllGlobals(); });

describe('Financiamento no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/financiamento', padrao: '/portal/:tenant/financiamento', elemento: <PortalFinanciamentoPage /> };
  const BANCOS = {
    financiamento: {
      enabled: true, title: 'Simule seu financiamento', intro: 'Escolha o banco.', footer: 'Taxas sujeitas a análise.',
      banks: [
        { key: 'caixa', name: 'Caixa', color: '#005CA9', url: 'https://caixa.gov.br/simulador' },
        { key: 'itau', name: 'Itaú', color: '#EC7000', url: 'https://itau.com.br/simule', logo_url: 'https://cdn.x/itau.png' },
      ],
    },
  };

  it('Clássico continua o de sempre', async () => {
    await abrir(ROTA, BANCOS as SiteInfo);
    expect(paginaModerna('financiamento')).toBeNull();
  });

  it('cabeçalho na cor principal, um cartão por banco com o mesmo link e o rodapé da página', async () => {
    await abrir(ROTA, { ...MODERNO, ...BANCOS } as SiteInfo);
    expect(paginaModerna('financiamento')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Simule seu financiamento' })).toBeTruthy();
    expect(screen.getByText('Escolha o banco.')).toBeTruthy();
    const caixa = screen.getByRole('link', { name: 'Simular financiamento no Caixa' });
    expect(caixa.getAttribute('href')).toBe('https://caixa.gov.br/simulador');
    expect(caixa.getAttribute('target')).toBe('_blank');
    expect(within(caixa).getByText('Simular no site do banco')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Simular financiamento no Itaú' }).getAttribute('href')).toBe('https://itau.com.br/simule');
    expect(screen.getByText('Taxas sujeitas a análise.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ficou com dúvida na simulação?' })).toBeTruthy();
  });

  it('sem banco com link: o aviso de hoje e o WhatsApp', async () => {
    await abrir(ROTA, { ...MODERNO, financiamento: { enabled: true, banks: [] } } as SiteInfo);
    expect(screen.getByText('Nossas condições de financiamento estão sendo atualizadas.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Fale com a gente no WhatsApp/ })).toBeTruthy();
  });
});

