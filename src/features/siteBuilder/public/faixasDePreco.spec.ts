import { describe, it, expect } from 'vitest';
import { filterProperties, type PortalProperty } from './filtros';
import { faixaDaBusca, faixasDePreco, precoDaFaixa } from './faixasDePreco';

describe('faixas de preço da busca', () => {
  it('compra (e lançamentos) usam as faixas de compra', () => {
    expect(faixasDePreco('sale').map(f => f.rotulo)).toEqual([
      'Até R$ 200 mil', 'R$ 200 mil a R$ 400 mil', 'R$ 400 mil a R$ 700 mil',
      'R$ 700 mil a R$ 1 mi', 'R$ 1 mi a R$ 2 mi', 'Acima de R$ 2 mi',
    ]);
    expect(faixasDePreco('launch')).toEqual(faixasDePreco('sale'));
  });
  it('aluguel tem as faixas próprias', () => {
    expect(faixasDePreco('rent').map(f => f.rotulo)).toEqual([
      'Até R$ 1.500', 'R$ 1.500 a R$ 3.000', 'R$ 3.000 a R$ 5.000', 'Acima de R$ 5.000',
    ]);
  });
  it('cada faixa vira price_min/price_max na URL (ponta aberta fica de fora)', () => {
    const [ate, , , , , acima] = faixasDePreco('sale');
    expect(precoDaFaixa('sale', ate.valor)).toEqual({ price_max: '200000' });
    expect(precoDaFaixa('sale', faixasDePreco('sale')[1].valor)).toEqual({ price_min: '200000', price_max: '400000' });
    expect(precoDaFaixa('sale', acima.valor)).toEqual({ price_min: '2000000' });
    expect(precoDaFaixa('rent', faixasDePreco('rent')[1].valor)).toEqual({ price_min: '1500', price_max: '3000' });
    expect(precoDaFaixa('sale', 'lixo')).toEqual({});
  });
  it('a URL volta para a faixa escolhida; preço fora das faixas não marca nenhuma', () => {
    expect(faixaDaBusca('sale', null, '200000')).toBe(faixasDePreco('sale')[0].valor);
    expect(faixaDaBusca('rent', '5000', null)).toBe(faixasDePreco('rent')[3].valor);
    expect(faixaDaBusca('sale', '123', '456')).toBe('');
    expect(faixaDaBusca('sale', null, null)).toBe('');
  });
  it('imóvel exatamente na divisa cai numa faixa só', () => {
    const casa = (preco: number) => ({ id: 'x', code: 'x', title: 'x', transaction_type: 'sale', property_type: 'house', sale_price_from: preco }) as PortalProperty;
    for (const tab of ['sale', 'rent'] as const) {
      for (const f of faixasDePreco(tab)) {
        for (const divisa of [f.price_min, f.price_max]) {
          if (divisa == null) continue;
          const dentro = faixasDePreco(tab).filter(g => filterProperties(
            [{ ...casa(divisa), transaction_type: tab === 'rent' ? 'rent' : 'sale', rent_price_from: divisa }],
            { tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '',
              price_min: String(g.price_min ?? ''), price_max: String(g.price_max ?? '') }).length === 1);
          expect(dentro).toHaveLength(1);
        }
      }
    }
  });
});
