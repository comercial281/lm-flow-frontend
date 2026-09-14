import { describe, it, expect } from 'vitest';
import {
  LEGADO_BASE,
  LEGADO_DESTAQUE,
  contarPorTipo,
  estouros,
  estourosDoErro,
  investimentoNormalizado,
  investimentoParaTela,
  legadoParaPublicacoes,
  limiteNormalizado,
  mensagemDeEstouro,
  temTiposDeAnuncio,
  tipoBase,
} from './adPlan';
import type { PortalAdType } from '@/services/portals/portalsService';

/**
 * Plano de anúncios: a conta que a tela faz ANTES de enviar tem que ser a
 * mesma do servidor — inclusive o texto do aviso, porque o diálogo aberto pela
 * tela e o aberto pelo 422 explicam o mesmo estouro.
 */
const tipos: PortalAdType[] = [
  { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 0 },
  { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 2, count: 0 },
  { key: 'super_premium', label: 'Super Destaque', feed_value: 'SUPER_PREMIUM', limit: 1, count: 0 },
];

const pubs = (pares: Array<[string, string]>) => new Map(pares);

describe('temTiposDeAnuncio / tipoBase', () => {
  it('servidor antigo (sem ad_types) cai no modo legado', () => {
    expect(temTiposDeAnuncio({})).toBe(false);
    expect(temTiposDeAnuncio({ ad_types: [] })).toBe(false);
    expect(temTiposDeAnuncio(null)).toBe(false);
    expect(temTiposDeAnuncio({ ad_types: tipos })).toBe(true);
  });

  it('o tipo base é o PRIMEIRO servido', () => {
    expect(tipoBase(tipos)?.key).toBe('standard');
    expect(tipoBase([])).toBeNull();
  });
});

describe('contarPorTipo', () => {
  it('conta cada tipo e devolve zero para os vazios', () => {
    const counts = contarPorTipo(tipos, pubs([['a', 'standard'], ['b', 'premium'], ['c', 'premium']]));
    expect(counts).toEqual({ standard: 1, premium: 2, super_premium: 0 });
  });

  it('tipo que o portal não conhece cai no base, como o servidor faz com nulo', () => {
    const counts = contarPorTipo(tipos, pubs([['a', 'sumiu'], ['b', 'premium']]));
    expect(counts).toEqual({ standard: 1, premium: 1, super_premium: 0 });
  });
});

describe('estouros', () => {
  it('cota nula nunca estoura; cota cheia não estoura; acima estoura com o excesso', () => {
    expect(estouros(tipos, { standard: 900, premium: 2, super_premium: 0 })).toEqual([]);
    expect(estouros(tipos, { standard: 0, premium: 3, super_premium: 4 })).toEqual([
      { key: 'premium', label: 'Destaque', limit: 2, count: 3, excess: 1 },
      { key: 'super_premium', label: 'Super Destaque', limit: 1, count: 4, excess: 3 },
    ]);
  });
});

describe('mensagemDeEstouro — o mesmo texto do servidor', () => {
  it('singular para 1 imóvel', () => {
    expect(mensagemDeEstouro([{ key: 'premium', label: 'Destaque', limit: 40, count: 41, excess: 1 }]))
      .toBe('Destaque: 41 de 40 — o portal rebaixa 1 imóvel para o tipo abaixo');
  });

  it('plural e "; " entre os tipos', () => {
    expect(mensagemDeEstouro([
      { key: 'premium', label: 'Destaque', limit: 2, count: 5, excess: 3 },
      { key: 'super_premium', label: 'Super Destaque', limit: 1, count: 2, excess: 1 },
    ])).toBe(
      'Destaque: 5 de 2 — o portal rebaixa 3 imóveis para o tipo abaixo; '
      + 'Super Destaque: 2 de 1 — o portal rebaixa 1 imóvel para o tipo abaixo',
    );
  });

  it('sem estouro, texto vazio', () => {
    expect(mensagemDeEstouro([])).toBe('');
  });
});

describe('legadoParaPublicacoes — servidor antigo, estrela como hoje', () => {
  it('destaque vira o SEGUNDO tipo e o resto vira o base', () => {
    expect(legadoParaPublicacoes(['a', 'b', 'c'], ['b'], tipos)).toEqual([
      { property_id: 'a', ad_type: 'standard' },
      { property_id: 'b', ad_type: 'premium' },
      { property_id: 'c', ad_type: 'standard' },
    ]);
  });

  it('portal de um tipo só: destaque cai no base (não existe tier acima)', () => {
    expect(legadoParaPublicacoes(['a', 'b'], ['b'], [tipos[0]])).toEqual([
      { property_id: 'a', ad_type: 'standard' },
      { property_id: 'b', ad_type: 'standard' },
    ]);
  });

  it('sem tipos conhecidos usa as chaves sentinela do modo legado', () => {
    expect(legadoParaPublicacoes(['a', 'b'], ['b'], [])).toEqual([
      { property_id: 'a', ad_type: LEGADO_BASE },
      { property_id: 'b', ad_type: LEGADO_DESTAQUE },
    ]);
  });

  it('destaque de imóvel que não está publicado é ignorado', () => {
    expect(legadoParaPublicacoes(['a'], ['zzz'], tipos)).toEqual([
      { property_id: 'a', ad_type: 'standard' },
    ]);
  });
});

describe('estourosDoErro — o 422 AD_PLAN_EXCEEDED vira a mesma lista', () => {
  const erro422 = {
    response: {
      status: 422,
      data: {
        success: false,
        error: {
          code: 'AD_PLAN_EXCEEDED',
          message: 'Destaque: 41 de 40 — o portal rebaixa 1 imóvel para o tipo abaixo',
          details: { overflows: [{ key: 'premium', label: 'Destaque', limit: 40, count: 41, excess: 1 }] },
        },
      },
    },
  };

  it('lê details.overflows do formato padrão da API', () => {
    expect(estourosDoErro(erro422)).toEqual([
      { key: 'premium', label: 'Destaque', limit: 40, count: 41, excess: 1 },
    ]);
  });

  it('qualquer outro erro devolve lista vazia — é "avise", não "pergunte"', () => {
    expect(estourosDoErro({ response: { status: 403, data: { error: 'Seu cargo não permite' } } })).toEqual([]);
    expect(estourosDoErro({
      response: { status: 422, data: { success: false, error: { code: 'INVALID_AD_TYPE', message: 'x' } } },
    })).toEqual([]);
    expect(estourosDoErro(new Error('rede'))).toEqual([]);
    expect(estourosDoErro(null)).toEqual([]);
  });

  it('excesso ausente é derivado de count - limit', () => {
    const semExcess = {
      response: {
        status: 422,
        data: {
          success: false,
          error: { code: 'AD_PLAN_EXCEEDED', message: 'x', details: { overflows: [{ key: 'p', label: 'P', limit: 1, count: 3 }] } },
        },
      },
    };
    expect(estourosDoErro(semExcess)[0].excess).toBe(2);
  });
});

describe('investimentoNormalizado — guarda "3593.45", aceita vírgula', () => {
  it.each([
    ['', { valido: true, valor: null }],
    ['3593,45', { valido: true, valor: '3593.45' }],
    ['3.593,45', { valido: true, valor: '3593.45' }],
    ['3593.45', { valido: true, valor: '3593.45' }],
    ['R$ 1.200', { valido: true, valor: '1200' }],
    ['abc', { valido: false, valor: null }],
    ['12,345', { valido: false, valor: null }],
  ])('%j → %j', (raw, esperado) => {
    expect(investimentoNormalizado(raw)).toEqual(esperado);
  });

  it('a tela mostra com vírgula', () => {
    expect(investimentoParaTela('3593.45')).toBe('3593,45');
    expect(investimentoParaTela(null)).toBe('');
  });
});

describe('limiteNormalizado — vazio, zero e negativo são ilimitado', () => {
  it.each([
    ['', null], ['   ', null], ['0', null], ['-3', null], ['abc', null],
    ['40', 40], [' 12 ', 12], ['3,7', 3], ['0.9', null],
  ])('%j → %j', (raw, esperado) => {
    expect(limiteNormalizado(raw)).toBe(esperado);
  });
});
