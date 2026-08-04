import { describe, expect, it } from 'vitest';
import {
  cleanTypologies,
  typologyHeadline,
  typologyName,
  typologyPrice,
  typologySpecs,
  type PropertyTypology,
} from './typologies';

const tipoA: PropertyTypology = {
  name: 'Tipo A',
  bedrooms: 2,
  suites: 1,
  parking_spaces: 1,
  useful_area_m2: 58.5,
  sale_price: 450000,
};
const cobertura: PropertyTypology = { bedrooms: 4, useful_area_m2: 120, sale_price: 1180000 };

describe('typologies', () => {
  it('usa o nome digitado e cai no nº de dormitórios quando não tem', () => {
    expect(typologyName(tipoA)).toBe('Tipo A');
    expect(typologyName(cobertura)).toBe('4 dormitórios');
    expect(typologyName({ bedrooms: 1 })).toBe('1 dormitório');
    expect(typologyName({}, 2)).toBe('Tipologia 3');
  });

  it('monta as specs só com o que foi preenchido', () => {
    expect(typologySpecs(tipoA)).toEqual(['2 dorm.', '1 suíte', '1 vaga', '58,5 m² úteis']);
    expect(typologySpecs({})).toEqual([]);
  });

  it('prioriza o valor de venda e marca /mês no aluguel', () => {
    expect(typologyPrice(tipoA)).toContain('450.000');
    expect(typologyPrice({ rent_price: 2500 })).toContain('/mês');
    expect(typologyPrice({})).toBeNull();
  });

  it('resume o empreendimento em uma linha de vitrine', () => {
    // Intl separa "R$" do número com espaço NÃO-quebrável — normaliza antes de comparar.
    const headline = typologyHeadline([tipoA, cobertura])?.replace(/ /g, ' ');
    expect(headline).toBe('2 a 4 dorms · 58,5 a 120 m² · a partir de R$ 450.000');
    expect(typologyHeadline([])).toBeNull();
    expect(typologyHeadline(null)).toBeNull();
  });

  it('descarta linhas em branco antes de salvar', () => {
    const linhaVazia: PropertyTypology = { name: '  ', bedrooms: null, notes: '' };
    expect(cleanTypologies([tipoA, linhaVazia])).toEqual([tipoA]);
    expect(cleanTypologies(undefined)).toEqual([]);
  });
});
