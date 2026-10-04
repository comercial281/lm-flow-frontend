import { describe, it, expect } from 'vitest';
import { rotuloTipo, pluralTipo } from './tiposDeImovel';

const ENUM = ['apartment','house','condo_house','lot','commercial_room','warehouse','farm','studio','kitnet','loft',
  'penthouse','duplex','triplex','cobertura','sobrado','sala_comercial','galpao','predio','terreno','chacara','sitio','other'];

describe('tiposDeImovel', () => {
  it('todo tipo do servidor tem nome em português', () => {
    ENUM.forEach(t => { expect(rotuloTipo(t)).not.toBe(t); expect(pluralTipo(t)).not.toBe(t); });
    expect(rotuloTipo('condo_house')).toBe('Casa em condomínio');
    expect(pluralTipo('apartment')).toBe('Apartamentos');
  });
  it('tipo desconhecido não quebra', () => {
    expect(rotuloTipo('nave')).toBe('Imóvel');
  });
});
