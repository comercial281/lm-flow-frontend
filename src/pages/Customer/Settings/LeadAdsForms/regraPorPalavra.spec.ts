import { describe, expect, it } from 'vitest';
import { normalizarNome, regraQuePega, type CadastroComPalavra } from './regraPorPalavra';

const cadastro = (extra: Partial<CadastroComPalavra> & { id: string }) => ({
  form_name: 'Formulário', match_keyword: null, meta_page_id: null, is_active: true, keyword_rule: true, ...extra,
});

describe('regra por palavra (espelho do roteador do servidor)', () => {
  it('normaliza como o servidor: minúsculo, sem data no começo, no fim e entre colchetes', () => {
    expect(normalizarNome('21/08 - ALMA Residencial')).toBe('- alma residencial');
    expect(normalizarNome('ALMA [08/07] INT COND')).toBe('alma int cond');
    expect(normalizarNome('Torres 13 12 2025')).toBe('torres');
  });

  it('pega quando todas as palavras da regra estão no nome; a mais longa vence', () => {
    const curta = cadastro({ id: 'a', match_keyword: 'alma' });
    const longa = cadastro({ id: 'b', match_keyword: 'alma residencial' });
    expect(regraQuePega('ALMA RESIDENCIAL 2.0', null, [curta, longa])?.id).toBe('b');
    expect(regraQuePega('ALMA LOFT', null, [curta, longa])?.id).toBe('a');
    expect(regraQuePega('CAPRI', null, [curta, longa])).toBeNull();
  });

  it('ignora cadastro desligado e cadastro de outra página', () => {
    const desligado = cadastro({ id: 'a', match_keyword: 'alma', is_active: false });
    const outraPagina = cadastro({ id: 'b', match_keyword: 'alma', meta_page_id: 'pg-2' });
    const semPagina = cadastro({ id: 'c', match_keyword: 'alma' });
    expect(regraQuePega('ALMA', 'pg-1', [desligado, outraPagina])).toBeNull();
    expect(regraQuePega('ALMA', 'pg-1', [outraPagina, semPagina])?.id).toBe('c');
  });

  it('ficha comum com a mesma palavra não pega: só a regra por palavra da roleta barra o lead de outro jeito', () => {
    const comum = cadastro({ id: 'a', match_keyword: 'alma', keyword_rule: false });
    const daRoleta = cadastro({ id: 'b', match_keyword: 'alma', keyword_rule: true });
    expect(regraQuePega('ALMA RESIDENCIAL', null, [comum])).toBeNull();
    expect(regraQuePega('ALMA RESIDENCIAL', null, [comum, daRoleta])?.id).toBe('b');
    expect(regraQuePega('ALMA RESIDENCIAL', null, [{ ...comum, keyword_rule: undefined }])).toBeNull();
  });

  it('sem palavra escrita, a regra é o nome do formulário cadastrado', () => {
    expect(regraQuePega('Capri 2.0 INT', null, [cadastro({ id: 'a', form_name: 'capri' })])?.id).toBe('a');
  });
});
