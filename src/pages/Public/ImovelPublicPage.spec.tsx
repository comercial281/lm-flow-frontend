import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImovelPublicPage from './ImovelPublicPage';
import type { SiteInfo } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Ficha do imóvel: o topo e o rodapé mostram só as abas ligadas no
   Personalizar (a ficha não carrega o catálogo, então não esconde aba vazia).
──────────────────────────────────────────────────────────────────────────── */

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

async function abrirFicha(site: SiteInfo) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties/C1')) return resposta({ data: { code: 'C1', title: 'Casa no Cambuí', transaction_type: 'sale', photos: [] } });
    if (url.includes('/site/properties')) return resposta({ data: [], meta: { total: 0 } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', ...site } });
    return resposta({});
  }));
  render(
    <MemoryRouter initialEntries={['/imovel/imob/C1']}>
      <Routes><Route path="/imovel/:tenant/:code" element={<ImovelPublicPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Casa no Cambuí' });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('ImovelPublicPage', () => {
  it('aba Lançamentos desligada não aparece no topo nem no rodapé da ficha', async () => {
    await abrirFicha({ home: { search: { tabs: { launch: false } } } });

    expect(screen.queryByRole('link', { name: 'Lançamentos' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Comprar' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Alugar' }).length).toBeGreaterThan(0);
  });

  it('site sem Personalizar: as três abas', async () => {
    await abrirFicha({});

    expect(screen.getAllByRole('link', { name: 'Lançamentos' }).length).toBeGreaterThan(0);
  });
});
