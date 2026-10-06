import { describe, it, expect } from 'vitest';
import { lerReais } from './receita';

describe('lerReais', () => {
  it.each([
    ['1500', 1500], ['1500,5', 1500.5], ['1.500,00', 1500], ['1500.00', 1500], ['0', 0], ['1.500', 1500], [' 900 ', 900],
  ])('%s vira %s', (texto, valor) => {
    expect(lerReais(texto)).toBe(valor);
  });

  it('vazio é "sem valor"', () => {
    expect(lerReais('')).toBeNull();
    expect(lerReais('   ')).toBeNull();
  });

  it.each(['abc', '-10', '1,234', '15,00,0'])('%s é inválido', (texto) => {
    expect(lerReais(texto)).toBeUndefined();
  });
});
