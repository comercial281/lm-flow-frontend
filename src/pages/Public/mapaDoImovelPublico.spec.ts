import { describe, expect, it } from 'vitest';
import { consultaDoMapa } from './mapaDoImovelPublico';

describe('consultaDoMapa', () => {
  it('com ponto: alfinete exato', () => {
    expect(consultaDoMapa({ latitude: -22.9, longitude: -47.06, address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP' }))
      .toEqual({ q: '-22.9,-47.06', legenda: 'Centro, Campinas, SP', exato: true });
  });
  it('sem ponto: região', () => {
    expect(consultaDoMapa({ address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP' }))
      .toEqual({ q: encodeURIComponent('Centro, Campinas, SP'), legenda: 'Centro, Campinas, SP', exato: false });
  });
  it('nada: sem mapa', () => {
    expect(consultaDoMapa({})).toBeNull();
  });
});
