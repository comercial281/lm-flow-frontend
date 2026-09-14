import { describe, expect, it, vi } from 'vitest';
import { PORTAL_MAX_PAGES, PORTAL_PAGE_SIZE, fetchAllPortalProperties } from './portalProperties';
import type { PortalProperty } from './portalShared';

// A busca do catálogo recebe o `fetch` por parâmetro, então o teste não toca
// no fetch global (que o setup da suíte proíbe de propósito).

function prop(i: number): PortalProperty {
  return { id: `id-${i}`, code: `AP${i}`, title: `Imóvel ${i}`, transaction_type: 'sale', property_type: 'apartment' };
}

/** Simula o endpoint paginado do servidor sobre um catálogo de `total` imóveis. */
function fakeServer(total: number, opts: { failPage?: number; duplicateOnPage2?: boolean } = {}) {
  const catalog = Array.from({ length: total }, (_, i) => prop(i + 1));
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    const page = Number(u.searchParams.get('page') || '1');
    const per = Number(u.searchParams.get('per_page') || '20');
    if (opts.failPage === page) return { ok: false, json: async () => ({}) } as unknown as Response;
    let data = catalog.slice((page - 1) * per, page * per);
    // Ordem instável no servidor: a página 2 repete o primeiro item da página 1.
    if (opts.duplicateOnPage2 && page === 2 && catalog.length) data = [catalog[0], ...data.slice(1)];
    return { ok: true, json: async () => ({ data, meta: { total, page, per_page: per } }) } as unknown as Response;
  });
  return { fetchImpl, calls };
}

describe('fetchAllPortalProperties', () => {
  it('pede a primeira página com o teto do servidor e o cabeçalho do cliente', async () => {
    const { fetchImpl, calls } = fakeServer(5);
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    expect(list).toHaveLength(5);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`per_page=${PORTAL_PAGE_SIZE}`);
    expect(calls[0]).toContain('page=1');
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), { headers: { 'X-Tenant': 'imob' } });
  });

  it('junta TODAS as páginas quando o catálogo passa de uma (390 imóveis = 4 páginas)', async () => {
    const { fetchImpl, calls } = fakeServer(390);
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    expect(list).toHaveLength(390);
    expect(calls).toHaveLength(4);
    expect(new Set(list.map(p => p.id)).size).toBe(390);
  });

  it('descarta imóvel repetido entre páginas (rede para ordem instável no servidor)', async () => {
    const { fetchImpl } = fakeServer(150, { duplicateOnPage2: true });
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    expect(new Set(list.map(p => p.id)).size).toBe(list.length);
    expect(list).toHaveLength(149);
  });

  it('falha numa página do meio não derruba o resto', async () => {
    const { fetchImpl } = fakeServer(250, { failPage: 2 });
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    // Páginas 1 e 3 chegaram: 100 + 50.
    expect(list).toHaveLength(150);
  });

  it('devolve vazio (e não estoura) quando o servidor recusa a primeira página', async () => {
    const { fetchImpl, calls } = fakeServer(80, { failPage: 1 });
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    expect(list).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('respeita o teto de páginas por visita', async () => {
    const { fetchImpl, calls } = fakeServer(PORTAL_PAGE_SIZE * (PORTAL_MAX_PAGES + 5));
    const list = await fetchAllPortalProperties('https://api.test', 'imob', fetchImpl);

    expect(calls).toHaveLength(PORTAL_MAX_PAGES);
    expect(list).toHaveLength(PORTAL_PAGE_SIZE * PORTAL_MAX_PAGES);
  });
});
