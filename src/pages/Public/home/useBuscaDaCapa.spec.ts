import { describe, expect, it } from 'vitest';
import { dividirCampos } from './useBuscaDaCapa';

describe('dividirCampos', () => {
  it('até 4 campos não tem Mais filtros', () => {
    expect(dividirCampos(['type', 'city', 'neighborhood', 'bedrooms'])).toEqual({ primeira: ['type', 'city', 'neighborhood', 'bedrooms'], mais: [] });
  });
  it('mais de 4: 3 na primeira linha, o texto incluso', () => {
    expect(dividirCampos(['type', 'place', 'city', 'price', 'bedrooms'])).toEqual({ primeira: ['type', 'place', 'city'], mais: ['price', 'bedrooms'] });
  });
  it('sem campo nenhum, nada nas duas', () => {
    expect(dividirCampos([])).toEqual({ primeira: [], mais: [] });
  });
});
