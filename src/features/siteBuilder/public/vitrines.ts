import type { SiteInfo } from '@/pages/Public/portalShared';
import { filterProperties, type PortalProperty } from './filtros';
import { resolverHome, TEXTO_FABRICA, type AbaId, type HomeConfig, type RegrasVitrine, type Vitrine } from './homeConfig';

const ABAS: AbaId[] = ['sale', 'rent', 'launch'];
const vazio = (tab: AbaId) => ({ tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '' });

export function abasVisiveis(home: HomeConfig, items: PortalProperty[]): AbaId[] {
  return ABAS.filter(t => home.search.tabs[t] && filterProperties(items, vazio(t)).length > 0);
}

function casaRegra(p: PortalProperty, r: RegrasVitrine): boolean {
  if (r.transaction === 'rent' && !['rent', 'season', 'sale_rent'].includes(p.transaction_type)) return false;
  if (r.transaction === 'sale' && ['rent', 'season'].includes(p.transaction_type)) return false;
  if (r.listing_kind && (p.listing_kind ?? 'resale') !== r.listing_kind) return false;
  if (r.property_types.length && !r.property_types.includes(p.property_type)) return false;
  if (r.cities.length && !r.cities.includes(p.address?.city ?? '')) return false;
  if (r.neighborhoods.length && !r.neighborhoods.includes(p.address?.neighborhood ?? '')) return false;
  if (r.stages.length && !(p.listing_kind === 'development' && r.stages.includes(p.stage ?? ''))) return false;
  if (r.featured_only && !(p.featured || p.exclusive)) return false;
  if (r.price_min != null || r.price_max != null) {
    const price = r.transaction === 'rent' ? p.rent_price_from : p.sale_price_from;
    if (price == null) return false;
    if (r.price_min != null && price < r.price_min) return false;
    if (r.price_max != null && price > r.price_max) return false;
  }
  return true;
}

export function itensDaVitrine(items: PortalProperty[], v: Vitrine, limite = 6): PortalProperty[] {
  const lista = v.kind === 'launches' ? items.filter(p => p.listing_kind === 'development')
    : v.kind === 'featured' ? items.filter(p => p.featured || p.exclusive)
    : v.rules ? items.filter(p => casaRegra(p, v.rules!)) : [];
  return lista.slice(0, limite);   // a API já vem dos mais recentes pros mais antigos
}

export function vitrinesVisiveis(home: HomeConfig, items: PortalProperty[]): { vitrine: Vitrine; itens: PortalProperty[] }[] {
  return home.showcases.filter(v => v.enabled)
    .map(vitrine => ({ vitrine, itens: itensDaVitrine(items, vitrine) }))
    .filter(x => x.itens.length > 0);
}

/** Query string do "Ver todos" de uma vitrine. */
export function buscaDaRegra(r: RegrasVitrine): string {
  const q = new URLSearchParams();
  const tab = r.listing_kind === 'development' ? 'launch' : r.transaction === 'rent' ? 'rent' : null;
  if (tab) q.set('tab', tab);
  if (r.property_types.length === 1) q.set('type', r.property_types[0]);
  if (r.cities.length === 1) q.set('city', r.cities[0]);
  if (r.neighborhoods.length === 1) q.set('neighborhood', r.neighborhoods[0]);
  if (r.price_min != null) q.set('price_min', String(r.price_min));
  if (r.price_max != null) q.set('price_max', String(r.price_max));
  if (r.stages.length === 1) q.set('stage', r.stages[0]);
  return q.toString();
}

export interface CartaoChamada {
  key: string; icone: 'bank' | 'sign' | 'search' | 'whatsapp' | 'link' | 'page';
  title: string; text: string; button: string; to: string; externo: boolean;
}

export function chamadasVisiveis(site: SiteInfo, tenant: string): CartaoChamada[] {
  const home = resolverHome(site.home);
  const d = home.callouts.defaults;
  const zap = (site.contact?.whatsapp ?? '').replace(/\D/g, '');
  const pagina = (slug: string) => (site.menu ?? []).some(m => m.slug === slug);
  const padrao = (key: 'financing' | 'listing' | 'wanted', ok: boolean, icone: CartaoChamada['icone'], to: string): CartaoChamada | null => {
    const c = d[key];
    if (!ok || !c.enabled) return null;
    const f = TEXTO_FABRICA[key];
    return { key, icone, title: c.title ?? f.title, text: c.text ?? f.text, button: c.button ?? f.button, to, externo: false };
  };
  const cards: (CartaoChamada | null)[] = [
    padrao('financing', !!site.financiamento?.enabled, 'bank', `/portal/${tenant}/financiamento`),
    padrao('listing', !!site.anuncie?.enabled, 'sign', `/portal/${tenant}/anuncie`),
    padrao('wanted', site.sections?.lead_capture !== false, 'search', '#contato'),
    ...home.callouts.custom.map((c, i): CartaoChamada | null => {
      const base = { key: `custom-${i}`, title: c.title, text: c.text ?? '', button: c.button ?? 'Saiba mais' };
      if (c.dest_type === 'whatsapp') return zap ? { ...base, icone: 'whatsapp', to: `https://wa.me/${zap}?text=${encodeURIComponent(c.title)}`, externo: true } : null;
      if (c.dest_type === 'page') return c.dest_value && pagina(c.dest_value) ? { ...base, icone: 'page', to: `/portal/${tenant}/p/${encodeURIComponent(c.dest_value)}`, externo: false } : null;
      return typeof c.dest_value === 'string' && /^https?:\/\//i.test(c.dest_value) ? { ...base, icone: 'link', to: c.dest_value, externo: true } : null;
    }),
  ];
  return cards.filter((c): c is CartaoChamada => c !== null);
}
