import { describe, expect, it } from 'vitest';
import { PROPERTY_FEATURES, CONDO_FEATURES, labelsFor } from './amenities';

describe('catálogo de características', () => {
  it('Água saiu das opções mas continua legível', () => {
    expect(PROPERTY_FEATURES.map(a => a.slug)).not.toContain('agua');
    expect(labelsFor(['agua'])).toEqual(['Água']);
  });
  it('piscina e sauna do imóvel viram privativas; as do condomínio não', () => {
    expect(labelsFor(['piscina', 'sauna', 'piscina_condominio'])).toEqual(['Piscina privativa', 'Sauna privativa', 'Piscina']);
  });
  it('as comodidades novas do condomínio têm rótulo', () => {
    expect(labelsFor(['cinema'])).toEqual(['Sala de cinema']);
  });
  it('19 do imóvel e 29 do condomínio', () => {
    expect([PROPERTY_FEATURES.length, CONDO_FEATURES.length]).toEqual([19, 29]);
  });
});
