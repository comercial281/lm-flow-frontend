import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBuscaDosImoveis } from './useBuscaDosImoveis';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn() }));

/* A lógica da busca, sem desenho: a mesma regra serve o Clássico e o Moderno. */

const resposta = (body: unknown) => ({ ok: true, json: async () => body });
const imovel = (code: string, tipo: 'sale' | 'rent') => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: tipo, property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: tipo === 'sale' ? 500000 : null, rent_price_from: tipo === 'rent' ? 2500 : null,
  address: { city: 'Campinas', neighborhood: 'Centro' },
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('useBuscaDosImoveis', () => {
  it('trocar de Comprar para Alugar zera a faixa de preço e a fase', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/site/properties')) return resposta({ data: [imovel('V1', 'sale'), imovel('A1', 'rent')], meta: { total: 2 } });
      if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob' } });
      return resposta({});
    }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/portal/imob/imoveis?price_min=300000&price_max=600000&stage=launch&bedrooms=2']}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useBuscaDosImoveis('imob'), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('ok'));
    expect(result.current.filters.price_min).toBe('300000');

    act(() => result.current.trocarAba('rent'));

    expect(result.current.filters.tab).toBe('rent');
    expect(result.current.filters.price_min).toBe('');
    expect(result.current.filters.price_max).toBe('');
    expect(result.current.filters.stage ?? '').toBe('');
    // O resto dos filtros fica.
    expect(result.current.filters.bedrooms).toBe('2');
  });
});
