import { describe, expect, it } from 'vitest';
import { digitosDoPreco, precoParaEnviar } from './sobreONegocio';

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
