import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalHomePage from './PortalHomePage';
import ImovelPublicPage from './ImovelPublicPage';
import { FaixaDePrevia, robotsDoSite, type SiteInfo } from './portalShared';
import { rastreamentoDoSite } from './usePortalTracking';
import { CHAVE_DO_MODELO, esquecerModeloDaPrevia, modeloDaPrevia } from '@/features/siteBuilder/public/previaDoModelo';
import { TEXTO_ENVIO_NA_PREVIA, esquecerPrevia } from '@/features/siteBuilder/public/previa';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
import { sendSiteVisit } from '@/features/siteBuilder/public/siteVisits';
vi.mock('@/features/siteBuilder/public/siteTracking', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/siteBuilder/public/siteTracking')>()),
  trackLead: vi.fn(),
}));
import { trackLead } from '@/features/siteBuilder/public/siteTracking';

/* ────────────────────────────────────────────────────────────────────────────
   Prévia do modelo (Meu site › Modelo do site › "Ver prévia"). O painel abre
   `<site>?modelo=<id>`; o site aplica o modelo só no navegador, sobre o site
   carregado. Faixa, noindex, sem visita e sem rastreamento.
──────────────────────────────────────────────────────────────────────────── */

const FAIXA_EDITORIAL = 'Prévia do modelo Editorial. Nada foi salvo.';
const FAIXA_DA_PREVIA = 'Prévia: o site ainda não está publicado.';
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const SITE: SiteInfo = {
  name: 'Imob Teste',
  branding: { primary_color: '#123456' },
  contact: { whatsapp: '5511987654321' },
  seo: { title: null },
  google: { indexable: true },
  tracking: { ga4: 'G-AB12', facebook_pixel: '123456', gtm_id: 'GTM-XYZ1' },
};

let envios: string[] = [];

function abrir(url: string, site: SiteInfo) {
  envios = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      envios.push(u);
      return ok({ success: true });
    }
    if (u.includes('/site/properties/C1')) {
      return ok({ data: { code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', address_city: 'Campinas', photos: [] } });
    }
    if (u.includes('/site/properties')) return ok({ data: [], meta: { total: 0 } });
    if (u.includes('/site/articles')) return ok({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(u)) return ok({ data: site });
    return ok({});
  }));
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

const limpar = () => {
  sessionStorage.clear();
  esquecerModeloDaPrevia();
  esquecerPrevia();
  window.history.replaceState({}, '', '/');
};

beforeEach(() => {
  document.head.innerHTML = '<meta name="robots" content="noindex">';
  limpar();
  delete (window as W).__lmfTracking;
  delete (window as W).gtag;
  delete (window as W).fbq;
  vi.mocked(sendSiteVisit).mockClear();
  vi.mocked(trackLead).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  limpar();
});

describe('faixa da prévia do modelo', () => {
  it('com modelo: "Prévia do modelo Editorial. Nada foi salvo."', () => {
    render(<FaixaDePrevia site={{ modelo_em_previa: 'editorial' }} />);
    expect(screen.getByRole('status').textContent).toBe(`${FAIXA_EDITORIAL} Ver o site normal`);
  });

  it('sem modelo e sem prévia: nada', () => {
    const { container } = render(<FaixaDePrevia site={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('prévia de site em manutenção + modelo: uma faixa só, com as duas informações', () => {
    render(<FaixaDePrevia site={{ preview: true, modelo_em_previa: 'popular' }} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent)
      .toBe('Prévia do modelo Popular. Nada foi salvo, e o site ainda não está publicado. Ver o site normal');
  });

  it('"Ver o site normal" esquece o modelo e leva ao mesmo endereço sem o modelo=', async () => {
    window.history.replaceState({}, '', '/portal/imob?previa=tok-1&modelo=editorial&tab=rent');
    modeloDaPrevia();
    // O jsdom não navega: a ida em si fica de fora, conferimos o destino.
    const semNavegar = (e: Event) => e.preventDefault();
    window.addEventListener('click', semNavegar);
    render(<FaixaDePrevia site={{ modelo_em_previa: 'editorial' }} />);
    const link = screen.getByRole('link', { name: 'Ver o site normal' });
    try {
      await userEvent.click(link);
    } finally {
      window.removeEventListener('click', semNavegar);
    }
    expect(sessionStorage.getItem(CHAVE_DO_MODELO)).toBeNull();
    expect(modeloDaPrevia({ search: '' })).toBeNull();
    const destino = new URL((link as HTMLAnchorElement).href);
    expect(destino.pathname).toBe('/portal/imob');
    expect(destino.searchParams.get('modelo')).toBeNull();
    expect(destino.searchParams.get('previa')).toBe('tok-1');
    expect(destino.searchParams.get('tab')).toBe('rent');
  });

  it('só a prévia de antes de publicar: a frase de sempre', () => {
    render(<FaixaDePrevia site={{ preview: true }} />);
    expect(screen.getByRole('status').textContent).toBe(FAIXA_DA_PREVIA);
  });
});

describe('robots e rastreamento na prévia do modelo', () => {
  it('noindex mesmo com o Google ligado e o site no ar', () => {
    expect(robotsDoSite({ google: { indexable: true }, modelo_em_previa: 'editorial' })).toBe('noindex');
    expect(robotsDoSite({ google: { indexable: true } })).toBe('index,follow');
  });

  it('nada de GA4, Pixel, GTM nem códigos', () => {
    expect(rastreamentoDoSite({ ...SITE, modelo_em_previa: 'classico' })).toEqual({ preview: true });
  });
});

describe('prévia do modelo no site', () => {
  it('página inicial com ?modelo=editorial: faixa, fundo escuro, noindex, sem visita e sem rastreamento', async () => {
    window.history.replaceState({}, '', '/portal/imob?modelo=editorial');
    const { container } = abrir('/portal/imob', SITE);
    expect(await screen.findByText(FAIXA_EDITORIAL)).toBeInTheDocument();
    expect(sessionStorage.getItem(CHAVE_DO_MODELO)).toBe('editorial');
    expect(container.querySelector('[data-fundo="escuro"]')).not.toBeNull();
    await waitFor(() => expect(robots()).toBe('noindex'));
    expect(sendSiteVisit).not.toHaveBeenCalled();
    expect((window as W).__lmfTracking).toBeUndefined();
    expect((window as W).gtag).toBeUndefined();
  });

  it('ficha do imóvel, depois da navegação interna (modelo guardado): faixa e noindex', async () => {
    // A página abriu com ?modelo= (primeira leitura) e a navegação interna perdeu a busca.
    window.history.replaceState({}, '', '/portal/imob?modelo=popular');
    modeloDaPrevia();
    window.history.replaceState({}, '', '/imovel/imob/C1');
    abrir('/imovel/imob/C1', SITE);
    expect(await screen.findByText('Prévia do modelo Popular. Nada foi salvo.')).toBeInTheDocument();
    await waitFor(() => expect(robots()).toBe('noindex'));
    expect(sendSiteVisit).not.toHaveBeenCalled();
  });

  it('sem ?modelo=: site normal, sem faixa, conta visita e segue o Google', async () => {
    const { container } = abrir('/portal/imob', SITE);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Prévia do modelo/)).toBeNull();
    expect(container.querySelector('[data-fundo="escuro"]')).toBeNull();
    await waitFor(() => expect(sendSiteVisit).toHaveBeenCalled());
    expect(robots()).toBe('index,follow');
  });

  it('contato da página inicial na prévia do modelo: nada é enviado, aviso da prévia e sem conversão', async () => {
    window.history.replaceState({}, '', '/portal/imob?modelo=editorial');
    abrir('/portal/imob', SITE);
    await userEvent.type(await screen.findByPlaceholderText('Como podemos te chamar?'), 'Maria');
    await userEvent.type(screen.getByPlaceholderText(BR_PHONE_PLACEHOLDER), '11987654321');
    await userEvent.click(screen.getByRole('button', { name: 'Quero ajuda pra encontrar' }));

    expect(await screen.findByText(TEXTO_ENVIO_NA_PREVIA)).toBeInTheDocument();
    expect(screen.queryByText('Recebemos seu contato!')).toBeNull();
    expect(envios.some(u => u.includes('/site/leads'))).toBe(false);
    expect(trackLead).not.toHaveBeenCalled();
  });
});
