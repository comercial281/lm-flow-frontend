// Filtro puro dos imóveis do site público. Mora aqui (e não no portalShared)
// para vitrines.ts poder usá-lo sem ciclo de import; o portalShared reexporta.
import { rotuloTipo } from './tiposDeImovel';

/* Aba de transação usada na busca. `launch` = lançamentos (empreendimento). */
export type PortalTab = 'sale' | 'rent' | 'launch';

export interface PortalProperty {
  id: string;
  code: string;
  title: string;
  /** Endereço legível da ficha no domínio (`/imovel/casa-sorocaba/A01`). Servidor velho não manda. */
  site_path?: string;
  transaction_type: string;
  property_type: string;
  display_price?: string;
  icon_summary?: { bedrooms?: number; bathrooms?: number; suites?: number; parking?: number; useful_area_m2?: number; total_area_m2?: number };
  address?: { city?: string; neighborhood?: string };
  cover_url?: string | null;
  featured?: boolean;
  exclusive?: boolean;
  /** 'resale' (revenda) ou 'development' (empreendimento). Ausente = revenda. */
  listing_kind?: 'resale' | 'development';
  stage?: string | null;
  /** 'YYYY-MM-DD' */
  delivery_forecast?: string | null;
  sale_price_from?: number | null;
  rent_price_from?: number | null;
  /** iso8601, para "Mais recentes". Servidor velho não manda. */
  created_at?: string | null;
  /** Minha Casa Minha Vida: só `true` conta (selo no cartão, regra da vitrine). Servidor velho não manda. */
  mcmv?: boolean | null;
  /** Nome do condomínio, só quando o imóvel está ligado a um. Ausente = sem condomínio. */
  condominium_name?: string | null;
}

/* Filtros aplicados na busca (dirigidos pela URL na página de busca). */
export interface PortalFilters {
  tab: PortalTab;
  type: string;
  city: string;
  neighborhood: string;
  bedrooms: string;
  code: string;
  price_min?: string;
  price_max?: string;
  suites?: string;
  parking?: string;
  stage?: string;
  /** Texto livre: procura no condomínio, no bairro e na cidade. */
  place?: string;
  /** Condomínio exato (sem diferença de maiúscula e acento). */
  condominium?: string;
  /** Área mínima em m² (útil; cai na total). */
  area?: string;
}

const RENT_TX = ['rent', 'season', 'sale_rent'];
const isDev = (p: PortalProperty) => p.listing_kind === 'development';

/**
 * Cidade e bairro casam sem diferença de maiúscula, acento e espaço nas pontas
 * ("campinas", "Campinas" e "CAMPÍNAS " são a mesma cidade). Vale na busca, nas
 * vitrines e nos mais buscados: todo lugar que compara usa esta função.
 */
export function normalizarTexto(v?: string | null): string {
  return (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Opção de uma lista de textos que representa `valor` (ver `normalizarTexto`); sem nenhuma, o próprio valor. */
export function opcaoDoTexto(opcoes: string[], valor: string): string {
  if (!valor) return '';
  const alvo = normalizarTexto(valor);
  return opcoes.find(o => normalizarTexto(o) === alvo) ?? valor;
}

/**
 * Opções de cidade/bairro sem repetir grafia: "Campinas", "campinas " e
 * "CAMPINAS" viram uma opção só, com a grafia que mais aparece (no empate, a
 * primeira), sem espaço nas pontas e em ordem alfabética do português.
 */
export function opcoesSemRepetir(valores: (string | null | undefined)[]): string[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const v of valores) {
    const chave = normalizarTexto(v);
    if (!chave) continue;
    const grafias = grupos.get(chave) ?? new Map<string, number>();
    const g = (v as string).trim();
    grafias.set(g, (grafias.get(g) ?? 0) + 1);
    grupos.set(chave, grafias);
  }
  // Map guarda a ordem de chegada: com `>` estrito, o empate fica com a primeira.
  const maisComum = (grafias: Map<string, number>) =>
    [...grafias].reduce((melhor, atual) => (atual[1] > melhor[1] ? atual : melhor))[0];
  return [...grupos.values()].map(maisComum).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const TODAS_AS_ABAS: PortalTab[] = ['sale', 'rent', 'launch'];

/**
 * Aba que a busca usa. Só vale aba visível (`abas`): a da URL que não é
 * (desligada ou sem imóvel) cai na da lista (`tabDaLista`, pelo caminho) e
 * depois na primeira visível. É a regra da página de busca; o mosaico dos Mais
 * buscados usa a mesma pra contar o que a busca vai mostrar.
 */
export function abaDaBusca(tabDaUrl: string | null, abas: PortalTab[] = TODAS_AS_ABAS, tabDaLista: PortalTab | null = null): PortalTab {
  const daUrl = abas.find(a => a === tabDaUrl);
  return daUrl ?? (tabDaLista && abas.includes(tabDaLista) ? tabDaLista : (abas[0] ?? 'sale'));
}

/**
 * Filtros da busca lidos da URL (`?type=…&city=…`), com a aba já decidida por
 * quem chama. É o que a página de busca usa, e o mosaico dos Mais buscados lê
 * o atalho do mesmo jeito: o bloco mostra o que a busca vai mostrar.
 */
export function filtrosDaUrl(params: URLSearchParams, tab: PortalTab): PortalFilters {
  return {
    tab,
    type: params.get('type') || '',
    city: params.get('city') || '',
    neighborhood: params.get('neighborhood') || '',
    bedrooms: params.get('bedrooms') || '',
    code: params.get('code') || '',
    price_min: params.get('price_min') || '',
    price_max: params.get('price_max') || '',
    suites: params.get('suites') || '',
    parking: params.get('parking') || '',
    // Fase escondida em Alugar não filtra (um ?stage= velho na URL zeraria a lista).
    stage: tab === 'rent' ? '' : params.get('stage') || '',
    place: params.get('place') || '',
    condominium: params.get('condominium') || '',
    area: params.get('area') || '',
  };
}

/** Área do imóvel em m²: a útil se houver, senão a total; `null` se nenhuma foi preenchida. */
export function areaDoImovel(p: PortalProperty): number | null {
  const util = p.icon_summary?.useful_area_m2 ?? 0;
  if (util > 0) return util;
  const total = p.icon_summary?.total_area_m2 ?? 0;
  return total > 0 ? total : null;
}

export function filterProperties(items: PortalProperty[], f: PortalFilters): PortalProperty[] {
  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  const pMin = num(f.price_min), pMax = num(f.price_max);
  const cidade = normalizarTexto(f.city), bairro = normalizarTexto(f.neighborhood);
  const condominio = normalizarTexto(f.condominium), lugar = normalizarTexto(f.place);
  const areaMin = num(f.area);
  return items.filter(p => {
    // Lançamentos = só empreendimento. Alugar = revenda de Locação, Temporada e
    // Venda + Locação; Comprar = tudo que não é só de aluguel (inclui
    // empreendimento).
    if (f.tab === 'launch' && !isDev(p)) return false;
    if (f.tab === 'rent' && (isDev(p) || !RENT_TX.includes(p.transaction_type))) return false;
    if (f.tab === 'sale' && (p.transaction_type === 'rent' || p.transaction_type === 'season')) return false;
    // Tipo pelo NOME: o seletor junta sinônimos do servidor (cobertura/penthouse,
    // terreno/lot…) numa opção só, então a opção tem de pegar todos eles.
    if (f.type && p.property_type !== f.type && rotuloTipo(p.property_type) !== rotuloTipo(f.type)) return false;
    if (cidade && normalizarTexto(p.address?.city) !== cidade) return false;
    if (bairro && normalizarTexto(p.address?.neighborhood) !== bairro) return false;
    if (condominio && normalizarTexto(p.condominium_name) !== condominio) return false;
    if (lugar && ![p.condominium_name, p.address?.neighborhood, p.address?.city].some(t => normalizarTexto(t).includes(lugar))) return false;
    if (areaMin != null) {
      const area = areaDoImovel(p);
      if (area == null || area < areaMin) return false;
    }
    if (f.bedrooms && (p.icon_summary?.bedrooms ?? 0) < Number(f.bedrooms)) return false;
    if (f.suites && (p.icon_summary?.suites ?? 0) < Number(f.suites)) return false;
    if (f.parking && (p.icon_summary?.parking ?? 0) < Number(f.parking)) return false;
    if (f.stage && !(isDev(p) && p.stage === f.stage)) return false;
    if (pMin != null || pMax != null) {
      const price = f.tab === 'rent' ? p.rent_price_from : p.sale_price_from;
      if (price == null) return false;
      if (pMin != null && price < pMin) return false;
      if (pMax != null && price > pMax) return false;
    }
    if (f.code && !p.code.toLowerCase().includes(f.code.toLowerCase())) return false;
    return true;
  });
}
