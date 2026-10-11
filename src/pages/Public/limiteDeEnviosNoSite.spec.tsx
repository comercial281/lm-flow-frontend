import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalHomePage from './PortalHomePage';
import ImovelPublicPage from './ImovelPublicPage';
import PortalAnunciePage from './PortalAnunciePage';
import type { SiteInfo } from './portalShared';
import { esquecerPrevia } from '@/features/siteBuilder/public/previa';
import { TEXTO_FALHA_DE_ENVIO } from '@/features/siteBuilder/public/limiteDeEnvios';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/siteBuilder/public/siteTracking')>()),
  trackLead: vi.fn(),
}));
import { trackLead } from '@/features/siteBuilder/public/siteTracking';

/* ────────────────────────────────────────────────────────────────────────────
   Formulários do site com envio que falha. Desde 11/10/2026 o servidor limita
   os envios (429 com a frase dele); a página inicial, além disso, mostrava
   "Recebemos seu contato!" mesmo quando o envio falhava.
──────────────────────────────────────────────────────────────────────────── */

const FRASE_DO_SERVIDOR = 'Muitos envios seguidos. Tente de novo em alguns minutos.';
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const SITE: SiteInfo = {
  name: 'Imob Teste',
  branding: { primary_color: '#123456' },
  contact: { whatsapp: '5511987654321' },
  seo: { title: null },
  google: { indexable: true },
} as SiteInfo;

/** O que o servidor responde ao envio do formulário. */
let respostaDoEnvio: () => unknown;

const limite = () =>
  new Response(JSON.stringify({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: FRASE_DO_SERVIDOR } }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '540' },
  });

function abrir(url: string, site: SiteInfo = SITE) {
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
    if (init?.method === 'POST' && !u.includes('/site/visits')) return respostaDoEnvio();
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
        <Route path="/portal/:tenant/anuncie" element={<PortalAnunciePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function enviarDaPaginaInicial() {
  await userEvent.type(await screen.findByPlaceholderText('Como podemos te chamar?'), 'Maria');
  await userEvent.type(screen.getByPlaceholderText(BR_PHONE_PLACEHOLDER), '11987654321');
  await userEvent.click(screen.getByRole('button', { name: 'Quero ajuda pra encontrar' }));
}

beforeEach(() => {
  sessionStorage.clear();
  esquecerPrevia();
  vi.mocked(trackLead).mockClear();
  respostaDoEnvio = () => ok({ success: true });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('página inicial: "Quero ajuda pra encontrar"', () => {
  it('envio que falha não mostra a confirmação: mostra o erro e mantém o que foi digitado', async () => {
    respostaDoEnvio = () => ({ ok: false, status: 500, json: async () => ({}) });
    abrir('/portal/imob');
    await enviarDaPaginaInicial();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_FALHA_DE_ENVIO);
    expect(screen.queryByText('Recebemos seu contato!')).toBeNull();
    expect(screen.getByPlaceholderText('Como podemos te chamar?')).toHaveValue('Maria');
    expect(trackLead).not.toHaveBeenCalled();
  });

  it('rede caída: o mesmo erro, sem confirmação', async () => {
    respostaDoEnvio = () => { throw new TypeError('Failed to fetch'); };
    abrir('/portal/imob');
    await enviarDaPaginaInicial();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_FALHA_DE_ENVIO);
    expect(screen.queryByText('Recebemos seu contato!')).toBeNull();
  });

  it('no limite de envios mostra a frase do servidor, sem "tente de novo em instantes"', async () => {
    respostaDoEnvio = limite;
    abrir('/portal/imob');
    await enviarDaPaginaInicial();

    expect(await screen.findByRole('alert')).toHaveTextContent(FRASE_DO_SERVIDOR);
    expect(screen.queryByText(/em instantes/)).toBeNull();
    expect(screen.queryByText('Recebemos seu contato!')).toBeNull();
  });

  it('envio aceito segue com a confirmação', async () => {
    abrir('/portal/imob');
    await enviarDaPaginaInicial();
    expect(await screen.findByText('Recebemos seu contato!')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('página do imóvel e Anuncie no limite de envios', () => {
  it('página do imóvel: a frase do servidor no lugar de "tente de novo em instantes"', async () => {
    respostaDoEnvio = limite;
    abrir('/imovel/imob/C1');
    await screen.findByRole('heading', { level: 1, name: 'Casa no Cambuí' });
    await userEvent.type(screen.getAllByPlaceholderText('Seu nome')[0], 'Maria');
    await userEvent.type(screen.getAllByPlaceholderText('Seu WhatsApp')[0], '11987654321');
    await userEvent.click(screen.getAllByRole('button', { name: 'Tenho interesse' })[0]);

    expect((await screen.findAllByText(FRASE_DO_SERVIDOR)).length).toBeGreaterThan(0);
    expect(screen.queryByText(TEXTO_FALHA_DE_ENVIO)).toBeNull();
  });

  it('Anuncie: a frase do servidor, e o que foi preenchido continua', async () => {
    respostaDoEnvio = limite;
    abrir('/portal/imob/anuncie', { ...SITE, anuncie: { enabled: true } } as SiteInfo);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.submit(document.querySelector('form')!);
    await userEvent.type(await screen.findByPlaceholderText('Como podemos te chamar?'), 'Maria');
    await userEvent.type(screen.getByPlaceholderText(BR_PHONE_PLACEHOLDER), '11987654321');
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(`${FRASE_DO_SERVIDOR} O que você preencheu continua aqui.`);
    expect(screen.getByPlaceholderText('Como podemos te chamar?')).toHaveValue('Maria');
  });
});
