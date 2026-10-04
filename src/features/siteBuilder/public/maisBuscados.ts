import type { PortalProperty } from './filtros';
import type { HomeConfig } from './homeConfig';
import { pluralTipo } from './tiposDeImovel';

export interface Atalho { label: string; query: string }

export function atalhosAutomaticos(items: PortalProperty[], max = 8): Atalho[] {
  const conta = new Map<string, { type: string; hood: string; n: number }>();
  for (const p of items) {
    const hood = p.address?.neighborhood;
    if (!hood || !p.property_type) continue;
    const k = `${p.property_type}|${hood}`;
    const cur = conta.get(k) ?? { type: p.property_type, hood, n: 0 };
    cur.n += 1; conta.set(k, cur);
  }
  return [...conta.values()].filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n || a.hood.localeCompare(b.hood))
    .slice(0, max)
    .map(x => ({ label: `${pluralTipo(x.type)} em ${x.hood}`,
                 query: new URLSearchParams({ type: x.type, neighborhood: x.hood }).toString() }));
}

export function atalhosDoSite(home: HomeConfig, items: PortalProperty[]): Atalho[] {
  const m = home.most_searched;
  if (!m.enabled) return [];
  if (m.mode === 'auto') return atalhosAutomaticos(items);
  return m.items.map(a => {
    const q = new URLSearchParams();
    if (a.transaction === 'rent') q.set('tab', 'rent');
    if (a.property_type) q.set('type', a.property_type);
    if (a.city) q.set('city', a.city);
    if (a.neighborhood) q.set('neighborhood', a.neighborhood);
    if (a.price_max != null) q.set('price_max', String(a.price_max));
    return { label: a.label, query: q.toString() };
  });
}
