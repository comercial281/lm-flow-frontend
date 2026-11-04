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
import { cabecalhosDoSite } from '@/features/siteBuilder/public/previa';

/** Teto do servidor (`per_page` é limitado a 100 lá). */
export const PORTAL_PAGE_SIZE = 100;
/** Teto de páginas por visita: 20 × 100 = 2.000 imóveis. */
export const PORTAL_MAX_PAGES = 20;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Página que o servidor recusou (5xx, 404 de manutenção): lista vazia. */
const FALHOU: PageResult = Object.freeze({ data: [], total: 0 }) as PageResult;

interface PageResult {
  data: PortalProperty[];
  total: number;
  /** Só com `listing_path`: "Casas à venda em Sorocaba". */
  listingTitle?: string | null;
}

async function fetchPage(
  api: string, tenant: string, page: number, fetchImpl: FetchLike, extra: Record<string, string> = {},
): Promise<PageResult> {
  const qs = new URLSearchParams({ ...extra, per_page: String(PORTAL_PAGE_SIZE), page: String(page) });
  const res = await fetchImpl(`${api}/api/public/v1/site/properties?${qs.toString()}`, {
    headers: cabecalhosDoSite(tenant),
  });
  if (!res.ok) return FALHOU;
  const json = await res.json();
  const data = Array.isArray(json?.data) ? (json.data as PortalProperty[]) : [];
  const total = typeof json?.meta?.total === 'number' ? json.meta.total : data.length;
  const listingTitle = typeof json?.meta?.listing_title === 'string' ? json.meta.listing_title : null;
  return { data, total, listingTitle };
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
  return (await buscarTodas(api, tenant, fetchImpl)).items;
}

/**
 * A chave da lista no caminho: o que vem depois de `/imoveis/`, no domínio
 * (`/imoveis/a-venda/casa`) ou no lmflow (`/portal/<t>/imoveis/a-venda/casa`).
 * `/imoveis` sozinho (a busca) = null.
 */
export function chaveDaLista(pathname: string): string | null {
  const m = pathname.match(/^(?:\/portal\/[^/]+)?\/imoveis\/(.+?)\/*$/);
  return m ? m[1] : null;
}

/** Uma lista do site (/imoveis/a-venda/casa/sorocaba): quem entra e o nome dela. */
export interface ListaDoSite {
  ids: Set<string>;
  titulo: string;
}

/**
 * Pergunta ao servidor quais imóveis entram na lista do caminho (`chave` = o
 * que vem depois de `/imoveis/`). O servidor é quem decide, com a MESMA regra
 * que montou o <head> e o sitemap (Sites::ListingPath) — a tela nunca recalcula
 * cidade/bairro por conta própria, senão o Google leria uma lista e a pessoa
 * veria outra.
 *
 * `null` = a lista não existe ou está vazia: o servidor já respondeu 404 pro
 * Google, e a tela mostra "Página não encontrada". Falha de rede sobe (erro).
 */
export async function fetchListaDoSite(
  api: string, tenant: string, chave: string, fetchImpl: FetchLike = fetch,
): Promise<ListaDoSite | null> {
  const { items, listingTitle } = await buscarTodas(api, tenant, fetchImpl, { listing_path: chave }, true);
  if (!items.length || !listingTitle) return null;
  return { ids: new Set(items.map(i => i.id)), titulo: listingTitle };
}

async function buscarTodas(
  api: string, tenant: string, fetchImpl: FetchLike, extra: Record<string, string> = {}, falhaSobe = false,
): Promise<{ items: PortalProperty[]; listingTitle: string | null }> {
  const pagina = async (n: number) => {
    const r = await fetchPage(api, tenant, n, fetchImpl, extra);
    if (falhaSobe && r === FALHOU) throw new Error('lista indisponível');
    return r;
  };
  const first = await pagina(1);
  const totalPages = Math.min(PORTAL_MAX_PAGES, Math.ceil(first.total / PORTAL_PAGE_SIZE));

  let rest: PortalProperty[] = [];
  if (totalPages > 1) {
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const results = await Promise.all(
      pages.map(p => pagina(p).catch(() => ({ data: [], total: 0 }))),
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
  return { items: all, listingTitle: first.listingTitle ?? null };
}
