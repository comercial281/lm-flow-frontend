import { describe, expect, it } from 'vitest';
import { finalidadeDoImovel, finalidadeInicial, imovelHref } from './finalidade';
import { filterProperties, type PortalFilters, type PortalProperty } from './portalShared';

const filtros = (tab: PortalFilters['tab']): PortalFilters =>
  ({ tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '' });

const imovel = (code: string, transaction_type: string): PortalProperty =>
  ({ id: code, code, title: code, transaction_type, property_type: 'apartment' });

/**
 * Venda e locação no site (spec 2026-09-30, D3): o formulário só pergunta quando
 * o imóvel não decide sozinho, e a aba Alugar da busca chega até a página do
 * imóvel para marcar "Quero alugar".
 */
describe('finalidade do lead do site', () => {
  it('o imóvel decide sozinho, menos o de Venda + Locação', () => {
    expect(finalidadeDoImovel('sale')).toBe('venda');
    expect(finalidadeDoImovel('rent')).toBe('locacao');
    expect(finalidadeDoImovel('season')).toBe('locacao');
    expect(finalidadeDoImovel('sale_rent')).toBeNull();
    expect(finalidadeDoImovel(undefined)).toBeNull();
  });

  it('a marcação inicial vem da URL ou da aba; sem nada, comprar', () => {
    expect(finalidadeInicial('locacao')).toBe('locacao');
    expect(finalidadeInicial('rent')).toBe('locacao');
    expect(finalidadeInicial('sale')).toBe('venda');
    expect(finalidadeInicial(null)).toBe('venda');
    expect(finalidadeInicial('qualquer')).toBe('venda');
  });

  it('o link do imóvel leva a aba Alugar, e só ela', () => {
    expect(imovelHref('imob', 'AP0042', 'rent')).toBe('/imovel/imob/AP0042?finalidade=locacao');
    expect(imovelHref('imob', 'AP0042', 'sale')).toBe('/imovel/imob/AP0042');
    expect(imovelHref('imob', 'AP0042')).toBe('/imovel/imob/AP0042');
  });
});

describe('filterProperties por aba', () => {
  const lista = [imovel('V', 'sale'), imovel('L', 'rent'), imovel('T', 'season'), imovel('VL', 'sale_rent')];

  it('Alugar mostra Locação, Temporada e Venda + Locação', () => {
    expect(filterProperties(lista, filtros('rent')).map(p => p.code)).toEqual(['L', 'T', 'VL']);
  });

  it('Comprar mostra Venda e Venda + Locação, e não Temporada', () => {
    expect(filterProperties(lista, filtros('sale')).map(p => p.code)).toEqual(['V', 'VL']);
  });
});
