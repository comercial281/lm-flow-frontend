import { filterProperties, type PortalFilters, type PortalProperty } from './filtros';
import type { AtalhoManual, HomeConfig } from './homeConfig';
import { opcaoDoTipo, pluralTipo, rotuloTipo } from './tiposDeImovel';

export interface Atalho { label: string; query: string }

export function atalhosAutomaticos(items: PortalProperty[], max = 8): Atalho[] {
  // Agrupa pelo NOME do tipo (cobertura/penthouse contam juntos); a busca leva
  // uma chave só desse nome, a primeira que aparece no catálogo.
  const tipos = [...new Set(items.map(p => p.property_type).filter(Boolean))];
  const conta = new Map<string, { type: string; hood: string; n: number }>();
  for (const p of items) {
    const hood = p.address?.neighborhood;
    if (!hood || !p.property_type) continue;
    const k = `${rotuloTipo(p.property_type)}|${hood}`;
    const cur = conta.get(k) ?? { type: opcaoDoTipo(tipos, p.property_type), hood, n: 0 };
    cur.n += 1; conta.set(k, cur);
  }
  return [...conta.values()].filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n || a.hood.localeCompare(b.hood))
    .slice(0, max)
    .map(x => ({ label: `${pluralTipo(x.type)} em ${x.hood}`,
                 query: new URLSearchParams({ type: x.type, neighborhood: x.hood }).toString() }));
}

/**
 * Filtros da busca a que um atalho manual leva. Finalidade nula conta como
 * Comprar (a tela não oferece mais "Qualquer"); cidade e bairro casam como na
 * busca (`normalizarTexto`), então vão como o cliente escreveu, só sem as pontas.
 */
function filtrosDoAtalho(a: AtalhoManual): PortalFilters {
  return {
    tab: a.transaction === 'rent' ? 'rent' : 'sale',
    type: a.property_type ?? '', city: a.city?.trim() ?? '', neighborhood: a.neighborhood?.trim() ?? '',
    bedrooms: '', code: '', price_max: a.price_max != null ? String(a.price_max) : '',
  };
}

export function atalhosDoSite(home: HomeConfig, items: PortalProperty[]): Atalho[] {
  const m = home.most_searched;
  if (!m.enabled) return [];
  if (m.mode === 'auto') return atalhosAutomaticos(items);
  // Atalho que leva a uma busca sem imóvel não aparece: seria um link pra "nada encontrado".
  return m.items.map(filtrosDoAtalho).flatMap((f, i) => {
    if (filterProperties(items, f).length === 0) return [];
    const q = new URLSearchParams();
    if (f.tab === 'rent') q.set('tab', 'rent');
    if (f.type) q.set('type', f.type);
    if (f.city) q.set('city', f.city);
    if (f.neighborhood) q.set('neighborhood', f.neighborhood);
    if (f.price_max) q.set('price_max', f.price_max);
    return [{ label: m.items[i].label, query: q.toString() }];
  });
}
