// src/pages/Customer/Properties/lista/estadoDaLista.ts
// Montagem pura dos parâmetros da lista de Imóveis: a tela só guarda o estado.
import type { PropertiesListParams } from '@/services/properties/propertiesService';
import { paramsDosFiltros, type Filtros, type ListingKind } from '@/features/properties/listingKind';

export const POR_PAGINA = 50;
export type Ordem = 'recent' | 'updated' | 'price_asc' | 'price_desc';
export type Visao = 'lista' | 'grade' | 'mapa';

export function paramsDaLista(a: {
  kind: ListingKind; filtros: Filtros; busca: string; ordem: Ordem;
  recorte: Record<string, string | string[]> | null; pagina: number;
}): PropertiesListParams {
  const q = a.busca.trim();
  return {
    listing_kind: a.kind,
    ...paramsDosFiltros(a.kind, a.filtros),
    ...(q ? { q } : {}),
    sort: a.ordem,
    // O link da Dashboard vence o filtro da tela, como já era.
    ...(a.recorte ?? {}),
    page: a.pagina,
    per_page: POR_PAGINA,
  } as PropertiesListParams;
}

// "Só os meus": a escolha fica neste navegador. Em aba anônima ou com o site bloqueado
// o acesso pode falhar, e aí só não lembra.
const CHAVE_SO_OS_MEUS = 'imoveis:so-os-meus';

export function lerSoOsMeus(): boolean {
  try { return localStorage.getItem(CHAVE_SO_OS_MEUS) === '1'; } catch { return false; }
}

export function gravarSoOsMeus(ligado: boolean): void {
  try {
    if (ligado) localStorage.setItem(CHAVE_SO_OS_MEUS, '1');
    else localStorage.removeItem(CHAVE_SO_OS_MEUS);
  } catch { /* só não lembra */ }
}

/**
 * O que estreita a lista e as abas. O link (Dashboard, Atividades) manda quando existe:
 * a escolha lembrada não pode mudar o número que a pessoa acabou de clicar.
 */
export function recorteDaLista(
  doLink: Record<string, string | string[]> | null,
  soOsMeus: boolean,
): Record<string, string | string[]> | null {
  if (doLink) return doLink;
  return soOsMeus ? { mine: '1' } : null;
}

export function lerVisao(sp: URLSearchParams): Visao {
  const v = sp.get('visao');
  return v === 'grade' || v === 'mapa' ? v : 'lista';
}
