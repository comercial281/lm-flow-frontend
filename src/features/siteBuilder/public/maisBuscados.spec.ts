import { describe, it, expect } from 'vitest';
import type { PortalProperty } from '@/pages/Public/portalShared';
import { resolverHome } from './homeConfig';
import { atalhosAutomaticos, atalhosDoSite } from './maisBuscados';

const p = (code: string, type: string, hood: string): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: type, address: { city: 'Campinas', neighborhood: hood } });

describe('mais buscados', () => {
  const items = [p('1','apartment','Cambuí'), p('2','apartment','Cambuí'), p('3','apartment','Cambuí'),
                 p('4','house','Barão Geraldo'), p('5','house','Barão Geraldo'), p('6','lot','Centro')];
  it('automático: combinações com 2+ imóveis, mais imóveis primeiro', () => {
    expect(atalhosAutomaticos(items)).toEqual([
      { label: 'Apartamentos em Cambuí', query: 'type=apartment&neighborhood=Cambu%C3%AD' },
      { label: 'Casas em Barão Geraldo', query: 'type=house&neighborhood=Bar%C3%A3o+Geraldo' },
    ]);
  });
  it('limite de 8', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => [p(`a${i}`, 'apartment', `B${i}`), p(`b${i}`, 'apartment', `B${i}`)]).flat();
    expect(atalhosAutomaticos(muitos).length).toBe(8);
  });
  it('manual vence; desligado → nada', () => {
    const manual = resolverHome({ most_searched: { mode: 'manual', items: [
      { label: 'Casas até 400 mil', transaction: 'sale', property_type: 'house', city: null, neighborhood: null, price_max: 400000 }] } });
    expect(atalhosDoSite(manual, items)).toEqual([{ label: 'Casas até 400 mil', query: 'type=house&price_max=400000' }]);
    expect(atalhosDoSite(resolverHome({ most_searched: { enabled: false } }), items)).toEqual([]);
  });
});
