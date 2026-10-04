import { describe, it, expect } from 'vitest';
import type { PortalProperty } from '@/pages/Public/portalShared';
import { resolverHome } from './homeConfig';
import { atalhosAutomaticos, atalhosDoSite } from './maisBuscados';

const p = (code: string, type: string, hood: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: code, transaction_type: 'sale', property_type: type, address: { city: 'Campinas', neighborhood: hood },
  sale_price_from: 300000, ...o });
const manual = (...items: Record<string, unknown>[]) => resolverHome({ most_searched: { mode: 'manual', items: items.map(a => ({
  transaction: 'sale', property_type: null, city: null, neighborhood: null, price_max: null, ...a })) } });

describe('mais buscados', () => {
  const items = [p('1','apartment','Cambuí'), p('2','apartment','Cambuí'), p('3','apartment','Cambuí'),
                 p('4','house','Barão Geraldo'), p('5','house','Barão Geraldo'), p('6','lot','Centro')];
  it('automático: combinações com 2+ imóveis, mais imóveis primeiro', () => {
    expect(atalhosAutomaticos(items)).toEqual([
      { label: 'Apartamentos em Cambuí', query: 'type=apartment&neighborhood=Cambu%C3%AD' },
      { label: 'Casas em Barão Geraldo', query: 'type=house&neighborhood=Bar%C3%A3o+Geraldo' },
    ]);
  });
  it('automático: sinônimos de tipo contam juntos e a busca leva uma chave só', () => {
    const lista = [p('1', 'penthouse', 'Cambuí'), p('2', 'cobertura', 'Cambuí')];
    expect(atalhosAutomaticos(lista)).toEqual([
      { label: 'Coberturas em Cambuí', query: 'type=penthouse&neighborhood=Cambu%C3%AD' },
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
  it('manual: atalho cuja busca dá 0 imóvel some', () => {
    const h = manual({ label: 'Casas baratas', property_type: 'house', price_max: 100000 }, { label: 'Aluguel', transaction: 'rent' },
      { label: 'Terrenos', property_type: 'lot' });
    expect(atalhosDoSite(h, items).map(a => a.label)).toEqual(['Terrenos']);
  });
  it('manual: cidade e bairro casam sem maiúscula/acento/espaço; finalidade nula conta como Comprar', () => {
    const h = manual({ label: 'Cambuí', city: 'CAMPÍNAS ', neighborhood: 'cambui' }, { label: 'Sem finalidade', transaction: null },
      { label: 'Santos', city: 'Santos' });
    expect(atalhosDoSite(h, items)).toEqual([
      { label: 'Cambuí', query: 'city=CAMP%C3%8DNAS&neighborhood=cambui' },
      { label: 'Sem finalidade', query: '' },
    ]);
    // Finalidade nula é Comprar: imóvel só de aluguel não segura o atalho.
    expect(atalhosDoSite(manual({ label: 'X', transaction: null }), [p('L', 'house', 'Centro', { transaction_type: 'rent' })])).toEqual([]);
  });
});
