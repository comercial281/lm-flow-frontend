import { describe, expect, it } from 'vitest';
import { dataValida, digitosDoPreco, precoInvalido, precoParaEnviar } from './sobreONegocio';

describe('preço estimado', () => {
  it('do servidor para o campo: reais inteiros, como o preço do imóvel', () => {
    expect(digitosDoPreco('450000.0')).toBe('450000');
    expect(digitosDoPreco('1234.56')).toBe('1235');
    expect(digitosDoPreco(null)).toBe('');
    expect(digitosDoPreco('')).toBe('');
  });

  it('do campo para o servidor: número ou null (limpa)', () => {
    expect(precoParaEnviar('450.000')).toBe(450000);
    expect(precoParaEnviar('')).toBeNull();
  });
});

describe('preço colado', () => {
  it('descarta os centavos, não multiplica por 100', () => {
    expect(precoParaEnviar('R$ 1.234,56')).toBe(1234);
    expect(precoParaEnviar('250000.0')).toBe(250000);
    expect(precoParaEnviar('1.234')).toBe(1234);
  });
  it('negativo e grande demais são inválidos', () => {
    expect(precoInvalido('-5')).toBe(true);
    expect(precoInvalido('1234567890123')).toBe(true);
    expect(precoInvalido('450.000')).toBe(false);
  });
  it('data: só ano de 1900 a 2100', () => {
    expect(dataValida('0002-12-20')).toBe(false);
    expect(dataValida('2026-12-20')).toBe(true);
  });
});
