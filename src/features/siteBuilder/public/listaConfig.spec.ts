import { describe, it, expect } from 'vitest';
import { LISTA_FABRICA, ORDENS, ROTULO_ORDEM, ehOrdem, resolverLista } from './listaConfig';

describe('resolverLista', () => {
  it('fábrica: mais recentes em grade', () => {
    expect(LISTA_FABRICA).toEqual({ default_sort: 'recent', card_layout: 'grid' });
    expect(resolverLista(undefined)).toEqual(LISTA_FABRICA);
    expect(resolverLista([])).toEqual(LISTA_FABRICA);
  });
  it('valor conhecido fica; desconhecido volta pro padrão', () => {
    expect(resolverLista({ default_sort: 'price_desc', card_layout: 'rows' })).toEqual({ default_sort: 'price_desc', card_layout: 'rows' });
    expect(resolverLista({ default_sort: 'xyz', card_layout: 'list' })).toEqual(LISTA_FABRICA);
  });
  it('as 4 ordens com os rótulos da tela', () => {
    expect(ORDENS).toEqual(['recent', 'price_asc', 'price_desc', 'area_desc']);
    expect(ROTULO_ORDEM).toEqual({ recent: 'Mais recentes', price_asc: 'Menor preço', price_desc: 'Maior preço', area_desc: 'Maior área' });
  });
  it('ehOrdem reconhece só as 4', () => {
    expect(ehOrdem('area_desc')).toBe(true);
    expect(ehOrdem('sort')).toBe(false);
    expect(ehOrdem(null)).toBe(false);
  });
});
