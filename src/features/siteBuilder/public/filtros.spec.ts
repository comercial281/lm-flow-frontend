import { describe, it, expect } from 'vitest';
import { opcoesSemRepetir } from './filtros';

describe('opcoesSemRepetir (cidades e bairros do site público)', () => {
  it('"Campinas" ×2 e "campinas " ×1 viram uma opção só, "Campinas"', () => {
    expect(opcoesSemRepetir(['Campinas', 'campinas ', 'Campinas'])).toEqual(['Campinas']);
  });
  it('mostra a grafia que mais aparece, mesmo que não seja a primeira', () => {
    expect(opcoesSemRepetir(['CAMBUÍ', 'Cambuí', 'cambui', 'Cambuí'])).toEqual(['Cambuí']);
  });
  it('no empate, a primeira que apareceu', () => {
    expect(opcoesSemRepetir(['sumaré', 'Sumaré'])).toEqual(['sumaré']);
  });
  it('ordem alfabética do português, sem vazio', () => {
    expect(opcoesSemRepetir(['Valinhos', null, 'Águas de Lindóia', '', '  ', undefined, 'Campinas', 'Barão Geraldo']))
      .toEqual(['Águas de Lindóia', 'Barão Geraldo', 'Campinas', 'Valinhos']);
  });
  it('a opção sai sem espaço nas pontas', () => {
    expect(opcoesSemRepetir([' Centro '])).toEqual(['Centro']);
  });
});
