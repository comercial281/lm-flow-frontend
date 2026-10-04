// Configuração da lista de imóveis (sites.settings['listing']).
// Espelho do Sites::ListingConfig do servidor: valor desconhecido volta pro padrão.
import { obj } from './homeConfig';

export type Ordem = 'recent' | 'price_asc' | 'price_desc' | 'area_desc';
export type LayoutDosCartoes = 'grid' | 'rows';

export const ORDENS: Ordem[] = ['recent', 'price_asc', 'price_desc', 'area_desc'];
export const LAYOUTS: LayoutDosCartoes[] = ['grid', 'rows'];

export const ROTULO_ORDEM: Record<Ordem, string> = {
  recent: 'Mais recentes',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  area_desc: 'Maior área',
};

export interface ListaConfig { default_sort: Ordem; card_layout: LayoutDosCartoes }

export const LISTA_FABRICA: ListaConfig = { default_sort: 'recent', card_layout: 'grid' };

export const ehOrdem = (v: unknown): v is Ordem => typeof v === 'string' && (ORDENS as string[]).includes(v);

export function resolverLista(raw: unknown): ListaConfig {
  const r = obj(raw);
  return {
    default_sort: ehOrdem(r.default_sort) ? r.default_sort : LISTA_FABRICA.default_sort,
    card_layout: LAYOUTS.find(l => l === r.card_layout) ?? LISTA_FABRICA.card_layout,
  };
}
