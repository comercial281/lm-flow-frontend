// src/pages/Customer/Properties/lista/estadoDaLista.ts
// Montagem pura dos parâmetros da lista de Imóveis: a tela só guarda o estado.
import type { PropertiesListParams } from '@/services/properties/propertiesService';
import { paramsDosFiltros, type Filtros, type ListingKind } from '@/features/properties/listingKind';

export const POR_PAGINA = 50;
export type Ordem = 'recent' | 'updated' | 'price_asc' | 'price_desc';
export type Visao = 'lista' | 'grade' | 'mapa';

export function paramsDaLista(a: {
  kind: ListingKind; filtros: Filtros; busca: string; ordem: Ordem;
  recorte: Record<string, string> | null; pagina: number;
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

export function lerVisao(sp: URLSearchParams): Visao {
  const v = sp.get('visao');
  return v === 'grade' || v === 'mapa' ? v : 'lista';
}
