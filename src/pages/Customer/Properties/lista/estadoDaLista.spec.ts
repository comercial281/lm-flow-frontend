// src/pages/Customer/Properties/lista/estadoDaLista.spec.ts
import { describe, expect, it } from 'vitest';
import { FILTROS_VAZIOS } from '@/features/properties/listingKind';
import { lerVisao, paramsDaLista } from './estadoDaLista';

describe('paramsDaLista', () => {
  it('junta tipo, filtros da aba, busca, ordem e o recorte da Dashboard', () => {
    const p = paramsDaLista({
      kind: 'resale', filtros: { ...FILTROS_VAZIOS.resale, finalidade: 'venda' }, busca: ' cambuí ',
      ordem: 'price_asc', recorte: { status: 'active', without_photos: '1' }, pagina: 2,
    });
    expect(p).toEqual({
      listing_kind: 'resale', 'transaction_type[]': ['sale', 'sale_rent'], q: 'cambuí', sort: 'price_asc',
      status: 'active', without_photos: '1', page: 2, per_page: 50,
    });
  });

  it('o recorte da Dashboard vence o filtro da tela (ex.: Sem fotos já é Disponível)', () => {
    const p = paramsDaLista({
      kind: 'resale', filtros: { ...FILTROS_VAZIOS.resale, situacao: 'sold' }, busca: '',
      ordem: 'recent', recorte: { status: 'active' }, pagina: 1,
    });
    expect(p.status).toBe('active');
  });
});

describe('lerVisao', () => {
  it('lê grade e mapa; o resto é lista', () => {
    expect(lerVisao(new URLSearchParams('visao=mapa'))).toBe('mapa');
    expect(lerVisao(new URLSearchParams('visao=grade'))).toBe('grade');
    expect(lerVisao(new URLSearchParams('visao=xpto'))).toBe('lista');
    expect(lerVisao(new URLSearchParams(''))).toBe('lista');
  });
});
