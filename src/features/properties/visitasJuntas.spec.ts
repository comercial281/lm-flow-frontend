import { describe, it, expect } from 'vitest';
import { aceitaVisitasJuntas } from './visitasJuntas';

describe('aceitaVisitasJuntas', () => {
  it('sem escolha, segue o tipo', () => {
    expect(aceitaVisitasJuntas({ listing_kind: 'development' })).toBe(true);
    expect(aceitaVisitasJuntas({ listing_kind: 'resale' })).toBe(false);
    expect(aceitaVisitasJuntas({ accepts_concurrent_visits: null, listing_kind: 'development' })).toBe(true);
  });

  it('a escolha vale mais que o tipo', () => {
    expect(aceitaVisitasJuntas({ accepts_concurrent_visits: false, listing_kind: 'development' })).toBe(false);
    expect(aceitaVisitasJuntas({ accepts_concurrent_visits: true, listing_kind: 'resale' })).toBe(true);
  });
});
