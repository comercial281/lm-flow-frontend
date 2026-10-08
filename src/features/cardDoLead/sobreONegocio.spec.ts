import { describe, expect, it } from 'vitest';
import { COLUNAS_DO_NEGOCIO_NO_CSV, camposDoNegocioNoCsv, dataValida, digitosDoPreco, precoInvalido, precoParaEnviar } from './sobreONegocio';

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

describe('Exportar do funil (spec §5.3)', () => {
  it('ganha preço estimado (cru, para a planilha somar) e data de fechamento (dia/mês/ano)', () => {
    expect(COLUNAS_DO_NEGOCIO_NO_CSV).toEqual(['preco_estimado', 'fechamento_esperado']);
    expect(camposDoNegocioNoCsv({ estimated_value: '450000.0', expected_close_on: '2026-12-20' }))
      .toEqual({ preco_estimado: '450000.0', fechamento_esperado: '20/12/2026' });
  });

  it('sem os dois, colunas vazias (nunca "—" nem "null")', () => {
    expect(camposDoNegocioNoCsv({ estimated_value: null, expected_close_on: null }))
      .toEqual({ preco_estimado: '', fechamento_esperado: '' });
    expect(camposDoNegocioNoCsv({})).toEqual({ preco_estimado: '', fechamento_esperado: '' });
  });

  it('preço zero ou lixo sai vazio; data não desloca com o fuso', () => {
    expect(camposDoNegocioNoCsv({ estimated_value: '0.0', expected_close_on: '2026-01-01' }))
      .toEqual({ preco_estimado: '', fechamento_esperado: '01/01/2026' });
  });
});
