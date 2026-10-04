import { describe, expect, it } from 'vitest';
import { resolverFicha } from '@/features/siteBuilder/public/fichaConfig';
import { construtoraDoImovel, dadosDoPredio, faseDoImovel, fichaDoImovel, sufixoDoIptu } from './fichaDoImovel';

const fabrica = resolverFicha(undefined);
const emp = { listing_kind: 'development' };

describe('fichaDoImovel', () => {
  it('servidor velho (sem listing_kind) é revenda, com tudo ligado', () => {
    const f = fichaDoImovel({}, fabrica);
    expect(f).toMatchObject({ tipo: 'resale', mapa: true, parecidos: true, valores: true, tipologias: true, fase: false, construtora: false });
  });

  it('chave da revenda não mexe no empreendimento', () => {
    const f = fichaDoImovel(emp, resolverFicha({ resale: { map: false, similar: false, values: false } }));
    expect(f).toMatchObject({ mapa: true, parecidos: true, valores: true });
  });
});

describe('construtoraDoImovel', () => {
  const f = fichaDoImovel(emp, fabrica);

  it('site que não é http(s) não vira link', () => {
    expect(construtoraDoImovel({ ...emp, builder: { name: 'Alfa', website: 'javascript:alert(1)' } }, f)).toEqual({ nome: 'Alfa', site: null });
  });

  it('sem nome, nada', () => {
    expect(construtoraDoImovel({ ...emp, builder: { name: '  ', website: 'https://alfa.com.br' } }, f)).toBeNull();
    expect(construtoraDoImovel({ ...emp, builder: null }, f)).toBeNull();
  });
});

describe('faseDoImovel', () => {
  it('pronto para morar não mostra previsão', () => {
    expect(faseDoImovel({ ...emp, stage: 'ready', delivery_forecast: '2027-03-01' }, fichaDoImovel(emp, fabrica))).toBe('Pronto para morar');
  });

  it('sem fase no cadastro, nada (não inventa "Pronto para morar")', () => {
    expect(faseDoImovel({ ...emp, stage: null }, fichaDoImovel(emp, fabrica))).toBeNull();
  });
});

describe('dadosDoPredio', () => {
  it('zero, negativo e padrão desconhecido não aparecem', () => {
    const f = fichaDoImovel(emp, fabrica);
    expect(dadosDoPredio({ ...emp, towers: 0, floors: -1, total_units: 1240, building_standard: 'xyz' }, f))
      .toEqual([{ rotulo: 'Unidades', valor: '1.240' }]);
  });
});

describe('sufixoDoIptu', () => {
  it('anual quando não vem ou é anual; mensal só quando diz', () => {
    expect(sufixoDoIptu({})).toBe('/ano');
    expect(sufixoDoIptu({ iptu_period: 'yearly' })).toBe('/ano');
    expect(sufixoDoIptu({ iptu_period: 'monthly' })).toBe('/mês');
  });
});
