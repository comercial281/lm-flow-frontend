// Filtro puro dos imóveis do site público. Mora aqui (e não no portalShared)
// para vitrines.ts poder usá-lo sem ciclo de import; o portalShared reexporta.
import { rotuloTipo } from './tiposDeImovel';

/* Aba de transação usada na busca. `launch` = lançamentos (empreendimento). */
export type PortalTab = 'sale' | 'rent' | 'launch';

export interface PortalProperty {
  id: string;
  code: string;
  title: string;
  transaction_type: string;
  property_type: string;
  display_price?: string;
  icon_summary?: { bedrooms?: number; bathrooms?: number; suites?: number; parking?: number; useful_area_m2?: number };
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

export function filterProperties(items: PortalProperty[], f: PortalFilters): PortalProperty[] {
  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  const pMin = num(f.price_min), pMax = num(f.price_max);
  const cidade = normalizarTexto(f.city), bairro = normalizarTexto(f.neighborhood);
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
