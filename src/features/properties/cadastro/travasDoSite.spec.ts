import { describe, expect, it } from 'vitest';
import { campoTravado, dicaSe, DICA_DO_CAMPO } from './travasDoSite';

const LISTA_COMBINADA = ['title', 'description', 'sale_price', 'address_neighborhood', 'address_city', 'bedrooms', 'occupancy', 'accepts_financing'];

describe('campos travados pelo site (campo por campo)', () => {
  it('trava só o que está na lista; o resto da mesma seção fica livre', () => {
    expect(campoTravado('address_neighborhood', LISTA_COMBINADA)).toBe(true);
    expect(campoTravado('bedrooms', LISTA_COMBINADA)).toBe(true);
    expect(campoTravado('address_street', LISTA_COMBINADA)).toBe(false);
    expect(campoTravado('bathrooms', LISTA_COMBINADA)).toBe(false);
    expect(campoTravado('condo_fee', LISTA_COMBINADA)).toBe(false);
  });
  it('o CEP do formulário (address_zip) segue o nome do servidor (address_cep)', () => {
    expect(campoTravado('address_zip', ['address_cep'])).toBe(true);
    expect(campoTravado('address_zip', LISTA_COMBINADA)).toBe(false);
  });
  it('sem campos travados (fonte desligada), nada trava', () => {
    expect(campoTravado('title', [])).toBe(false);
  });
  it('dica só no campo travado', () => {
    expect(dicaSe(true)).toBe(DICA_DO_CAMPO);
    expect(dicaSe(false)).toBeUndefined();
  });
});
