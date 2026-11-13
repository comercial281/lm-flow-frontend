import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import PortalHomePage from '../PortalHomePage';
import type { PortalProperty, SiteInfo } from '../portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Ajudantes dos testes da página inicial (Clássico e Moderno): o servidor é
   simulado pelo fetch (`/site` devolve o site e `/site/properties` o catálogo)
   e a página de busca só mostra a URL a que a capa levou.
──────────────────────────────────────────────────────────────────────────── */

export const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
export const empreendimento = (code: string, o: Partial<PortalProperty> = {}) =>
  imovel(code, { listing_kind: 'development', stage: 'launch', ...o });

/** Destino da busca: mostra a URL a que a capa levou. */
function Busca() {
  const { search } = useLocation();
  return <p data-testid="busca">{search}</p>;
}

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

export function servidor(site: SiteInfo, items: PortalProperty[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: site });
    return resposta({});
  }));
}

export async function abrirHome(site: SiteInfo, items: PortalProperty[]) {
  servidor({ name: 'Imob Teste', ...site }, items);
  render(
    <MemoryRouter initialEntries={['/portal/imob']}>
      <Routes>
        <Route path="/portal/:tenant" element={<PortalHomePage />} />
        <Route path="/portal/:tenant/imoveis" element={<Busca />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}
