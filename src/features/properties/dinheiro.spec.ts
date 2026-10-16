import { describe, expect, it } from 'vitest';
import { lerDinheiro, textoDoDinheiro } from './dinheiro';

describe('lerDinheiro', () => {
  it.each([
    ['244630', 244630, '244.630'],
    ['244.630', 244630, '244.630'],
    ['244.630,00', 244630, '244.630,00'],
    ['R$ 267.818,06', 267818.06, '267.818,06'],
    ['1.234.567', 1234567, '1.234.567'],
    ['800,5', 800.5, '800,5'],
    ['12,345', 12.34, '12,34'],
    ['0', 0, '0'],
  ])('%s vira %s', (bruto, valor, texto) => {
    expect(lerDinheiro(bruto)).toEqual({ valor, texto });
  });

  it('vazio e sem dígito viram nulo', () => {
    expect(lerDinheiro('')).toEqual({ valor: null, texto: '' });
    expect(lerDinheiro('R$ ')).toEqual({ valor: null, texto: '' });
  });

  it('vírgula no fim continua na caixa (a pessoa vai digitar os centavos)', () => {
    expect(lerDinheiro('244.630,')).toEqual({ valor: 244630, texto: '244.630,' });
  });
});

describe('textoDoDinheiro', () => {
  it('formata com milhar e centavos só quando tem', () => {
    expect(textoDoDinheiro(244633)).toBe('244.633');
    expect(textoDoDinheiro(267818.06)).toBe('267.818,06');
    expect(textoDoDinheiro(800.5)).toBe('800,50');
    expect(textoDoDinheiro(null)).toBe('');
  });
});
