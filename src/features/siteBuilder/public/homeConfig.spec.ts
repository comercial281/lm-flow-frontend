import { describe, it, expect } from 'vitest';
import { resolverHome, HOME_FABRICA } from './homeConfig';

describe('resolverHome', () => {
  it('nada/lixo → fábrica', () => {
    expect(resolverHome(undefined)).toEqual(HOME_FABRICA);
    expect(resolverHome('x')).toEqual(HOME_FABRICA);
    expect(HOME_FABRICA.showcases.map(v => v.id)).toEqual(['launches', 'featured']);
    expect(HOME_FABRICA.search.fields).toEqual(['type', 'city', 'neighborhood', 'bedrooms', 'code']);
  });
  it('mescla o que veio por cima da fábrica', () => {
    const h = resolverHome({ search: { title: 'Oi', tabs: { rent: false } }, callouts: { layout: 'cards' } });
    expect(h.search.title).toBe('Oi');
    expect(h.search.tabs).toEqual({ sale: true, rent: false, launch: true });
    expect(h.callouts.layout).toBe('cards');
    expect(h.callouts.defaults.financing.enabled).toBe(true);
  });
});
