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
  it('textos das chamadas que não são texto viram null (texto de fábrica), sem quebrar', () => {
    const h = resolverHome({ callouts: {
      defaults: { financing: { enabled: 'sim', title: 5, text: { a: 1 }, button: ['x'] }, listing: { title: 'Venda' } },
      custom: [
        { title: 'Blog', text: 3, button: {}, dest_type: 'url', dest_value: 42 },
        { title: 'Ok', text: 'Leia', button: 'Ir', dest_type: 'url', dest_value: 'https://x.com', lixo: 1 },
        { title: 7, dest_type: 'url' },
      ],
    } });
    expect(h.callouts.defaults.financing).toEqual({ enabled: true, title: null, text: null, button: null });
    expect(h.callouts.defaults.listing).toEqual({ enabled: true, title: 'Venda', text: null, button: null });
    expect(h.callouts.custom).toEqual([
      { title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: null },
      { title: 'Ok', text: 'Leia', button: 'Ir', dest_type: 'url', dest_value: 'https://x.com' },
    ]);
  });
});
