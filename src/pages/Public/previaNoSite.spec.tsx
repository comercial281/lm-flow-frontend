import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalHomePage from './PortalHomePage';
import ImovelPublicPage from './ImovelPublicPage';
import { TEXTO_MANUTENCAO } from './PaginaManutencao';
import type { SiteInfo } from './portalShared';
import { CHAVE_DA_PREVIA, esquecerPrevia } from '@/features/siteBuilder/public/previa';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
import { sendSiteVisit } from '@/features/siteBuilder/public/siteVisits';

/* ────────────────────────────────────────────────────────────────────────────
   Prévia antes de publicar. O painel abre `<site>?previa=<token>`; o site
   guarda o token e manda `X-Site-Preview` em toda chamada. O servidor, com o
   token válido, devolve o site inteiro com `preview: true`. Na prévia: faixa,
   noindex, sem visita e sem rastreamento nenhum.
──────────────────────────────────────────────────────────────────────────── */

const FAIXA = 'Prévia: o site ainda não está publicado.';
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const SITE: SiteInfo = {
  name: 'Imob Teste',
  branding: { primary_color: '#123456' },
  contact: { whatsapp: '5511987654321' },
  seo: { title: null },
  google: { indexable: true },
  // GA4, Pixel, GTM e códigos vêm de propósito: na prévia nenhum roda.
  tracking: { ga4: 'G-AB12', facebook_pixel: '123456', gtm_id: 'GTM-XYZ1' },
  custom_code: { head: '<meta name="lmf-codigo" content="1">', body: null },
};

let pedidos: { url: string; headers: Record<string, string> }[] = [];

function servidor(site: SiteInfo) {
  pedidos = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    pedidos.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('/site/properties/C1')) {
      return ok({ data: { code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', address_city: 'Campinas', photos: [] } });
    }
    if (url.includes('/site/properties')) return ok({ data: [], meta: { total: 0 } });
    if (url.includes('/site/articles')) return ok({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return ok({ data: site });
    return ok({});
  }));
}

function abrir(url: string, site: SiteInfo) {
  servidor(site);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/portal/:tenant" element={<PortalHomePage />} />
        <Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content;
type W = Window & { __lmfTracking?: boolean; gtag?: unknown; fbq?: unknown };

beforeEach(() => {
  document.head.innerHTML = '<meta name="robots" content="noindex">';
  sessionStorage.clear();
  esquecerPrevia();
  delete (window as W).__lmfTracking;
  delete (window as W).gtag;
  delete (window as W).fbq;
  vi.mocked(sendSiteVisit).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  esquecerPrevia();
  window.history.replaceState({}, '', '/');
});

describe('prévia no site', () => {
  it('?previa= na URL vai em X-Site-Preview em todas as chamadas públicas', async () => {
    window.history.replaceState({}, '', '/portal/imob?previa=tok-123');
    abrir('/portal/imob', { ...SITE, preview: true });
    await screen.findByText(FAIXA);
    expect(sessionStorage.getItem(CHAVE_DA_PREVIA)).toBe('tok-123');
    expect(pedidos.length).toBeGreaterThan(1);
    for (const p of pedidos) {
      expect(p.headers['X-Site-Preview']).toBe('tok-123');
      expect(p.headers['X-Tenant']).toBe('imob');
    }
  });

  it('na página inicial: faixa, noindex, sem visita e sem rastreamento', async () => {
    sessionStorage.setItem(CHAVE_DA_PREVIA, 'tok-123');
    abrir('/portal/imob', { ...SITE, preview: true });
    expect(await screen.findByText(FAIXA)).toBeInTheDocument();
    // Google ligado no site, mas a prévia nunca vai pro Google.
    await waitFor(() => expect(robots()).toBe('noindex'));
    expect(sendSiteVisit).not.toHaveBeenCalled();
    const w = window as W;
    expect(w.__lmfTracking).toBeUndefined();
    expect(w.gtag).toBeUndefined();
    expect(w.fbq).toBeUndefined();
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(document.head.querySelector('meta[name="lmf-codigo"]')).toBeNull();
  });

  it('com o site em manutenção, a prévia mostra o site como publicado (não a página de manutenção)', async () => {
    sessionStorage.setItem(CHAVE_DA_PREVIA, 'tok-123');
    abrir('/portal/imob', { ...SITE, maintenance: true, preview: true });
    expect(await screen.findByText(FAIXA)).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MANUTENCAO)).toBeNull();
  });

  it('na ficha do imóvel: faixa, noindex e sem visita', async () => {
    sessionStorage.setItem(CHAVE_DA_PREVIA, 'tok-123');
    abrir('/imovel/imob/C1', { ...SITE, preview: true });
    expect(await screen.findByText(FAIXA)).toBeInTheDocument();
    await waitFor(() => expect(robots()).toBe('noindex'));
    expect(sendSiteVisit).not.toHaveBeenCalled();
    expect((window as W).__lmfTracking).toBeUndefined();
    expect(pedidos.every(p => p.headers['X-Site-Preview'] === 'tok-123')).toBe(true);
  });

  it('fora da prévia: sem faixa, sem X-Site-Preview, conta visita e segue o Google', async () => {
    abrir('/portal/imob', SITE);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(FAIXA)).toBeNull();
    expect(pedidos.some(p => 'X-Site-Preview' in p.headers)).toBe(false);
    await waitFor(() => expect(sendSiteVisit).toHaveBeenCalled());
    expect(robots()).toBe('index,follow');
  });

  it('token que o servidor recusou (sem preview: true): site normal, sem faixa', async () => {
    sessionStorage.setItem(CHAVE_DA_PREVIA, 'vencido');
    abrir('/portal/imob', SITE);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(FAIXA)).toBeNull();
    await waitFor(() => expect(sendSiteVisit).toHaveBeenCalled());
  });
});
