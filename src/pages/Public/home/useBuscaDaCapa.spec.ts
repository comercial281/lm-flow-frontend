import { describe, expect, it } from 'vitest';
import { dividirCampos, lugarLargo } from './useBuscaDaCapa';

describe('dividirCampos', () => {
  it('até 4 campos não tem Mais filtros, nos dois modelos', () => {
    for (const modelo of ['classico', 'moderno'] as const) {
      expect(dividirCampos(['type', 'city', 'neighborhood', 'bedrooms'], modelo)).toEqual({ primeira: ['type', 'city', 'neighborhood', 'bedrooms'], mais: [] });
      expect(dividirCampos(['type', 'place', 'city', 'bedrooms'], modelo)).toEqual({ primeira: ['type', 'place', 'city', 'bedrooms'], mais: [] });
    }
  });
  it('Moderno com mais de 4: 3 na barra, o texto incluso', () => {
    expect(dividirCampos(['type', 'place', 'city', 'price', 'bedrooms'], 'moderno')).toEqual({ primeira: ['type', 'place', 'city'], mais: ['price', 'bedrooms'] });
    expect(dividirCampos(['type', 'city', 'neighborhood', 'price', 'bedrooms'], 'moderno')).toEqual({ primeira: ['type', 'city', 'neighborhood'], mais: ['price', 'bedrooms'] });
  });
  it('Clássico com mais de 4 e o texto entre os 3 primeiros: 3 campos (o texto ocupa 2 colunas)', () => {
    const r = dividirCampos(['type', 'place', 'city', 'price', 'bedrooms'], 'classico');
    expect(r).toEqual({ primeira: ['type', 'place', 'city'], mais: ['price', 'bedrooms'] });
    expect(lugarLargo(r.primeira, r.mais)).toBe(true);
  });
  it('Clássico com mais de 4 e sem o texto: 4 campos enchem a linha', () => {
    const r = dividirCampos(['type', 'city', 'neighborhood', 'price', 'bedrooms', 'area'], 'classico');
    expect(r).toEqual({ primeira: ['type', 'city', 'neighborhood', 'price'], mais: ['bedrooms', 'area'] });
    expect(lugarLargo(r.primeira, r.mais)).toBe(false);
  });
  it('lugar largo só com Mais filtros', () => {
    expect(lugarLargo(['type', 'place', 'city'], [])).toBe(false);
  });
  it('sem campo nenhum, nada nas duas', () => {
    expect(dividirCampos([], 'classico')).toEqual({ primeira: [], mais: [] });
  });
});
