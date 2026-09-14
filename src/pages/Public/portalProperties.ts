/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — busca do CATÁLOGO INTEIRO de imóveis publicados.

   O endpoint público (`/api/public/v1/site/properties`) é PAGINADO: 20 por
   página por padrão, 100 no máximo. O portal filtra no navegador (cidade,
   bairro, dormitórios, código) e monta as listas dos seletores a partir do que
   carregou — então ele precisa do catálogo COMPLETO, não de uma página.

   Antes disto o portal pedia UMA página de 60 e parava: cliente com 390
   imóveis publicados via 60 no site, a lista de bairros vinha pela metade e o
   contador "imóveis disponíveis" mentia. Nada quebrava, nenhum erro aparecia.

   Como funciona: pede a primeira página com o teto (100), lê o `meta.total`
   e busca as páginas restantes EM PARALELO. Repetidos são descartados por id
   (rede de segurança para ordem instável no servidor). Há um teto de páginas
   para um catálogo absurdo não virar dezenas de requisições por visita.
──────────────────────────────────────────────────────────────────────────── */

import type { PortalProperty } from './portalShared';

/** Teto do servidor (`per_page` é limitado a 100 lá). */
export const PORTAL_PAGE_SIZE = 100;
/** Teto de páginas por visita: 20 × 100 = 2.000 imóveis. */
export const PORTAL_MAX_PAGES = 20;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface PageResult {
  data: PortalProperty[];
  total: number;
}

async function fetchPage(
  api: string, tenant: string, page: number, fetchImpl: FetchLike,
): Promise<PageResult> {
  const qs = new URLSearchParams({ per_page: String(PORTAL_PAGE_SIZE), page: String(page) });
  const res = await fetchImpl(`${api}/api/public/v1/site/properties?${qs.toString()}`, {
    headers: { 'X-Tenant': tenant },
  });
  if (!res.ok) return { data: [], total: 0 };
  const json = await res.json();
  const data = Array.isArray(json?.data) ? (json.data as PortalProperty[]) : [];
  const total = typeof json?.meta?.total === 'number' ? json.meta.total : data.length;
  return { data, total };
}

/**
 * Busca todas as páginas do catálogo público e devolve a lista inteira, sem
 * repetidos. A primeira página vai sozinha (é ela que diz o total); as demais
 * saem em paralelo. Falha de uma página do meio não derruba o resto — o que
 * chegou é mostrado, e o portal segue no ar.
 */
export async function fetchAllPortalProperties(
  api: string, tenant: string, fetchImpl: FetchLike = fetch,
): Promise<PortalProperty[]> {
  const first = await fetchPage(api, tenant, 1, fetchImpl);
  const totalPages = Math.min(PORTAL_MAX_PAGES, Math.ceil(first.total / PORTAL_PAGE_SIZE));

  let rest: PortalProperty[] = [];
  if (totalPages > 1) {
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const results = await Promise.all(
      pages.map(p => fetchPage(api, tenant, p, fetchImpl).catch(() => ({ data: [], total: 0 }))),
    );
    rest = results.flatMap(r => r.data);
  }

  const seen = new Set<string>();
  const all: PortalProperty[] = [];
  for (const p of [...first.data, ...rest]) {
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    all.push(p);
  }
  return all;
}
