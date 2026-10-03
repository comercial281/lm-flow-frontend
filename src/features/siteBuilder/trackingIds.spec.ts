import { describe, it, expect } from 'vitest';
import { normalizarGa4, normalizarPixel, normalizarGtm, erroGa4, erroPixel, erroGtm } from './trackingIds';

describe('trackingIds', () => {
  it('normaliza', () => {
    expect(normalizarGa4(' g-ab12cd34ef ')).toBe('G-AB12CD34EF');
    expect(normalizarPixel('1234 5678 9012 345')).toBe('123456789012345');
    expect(normalizarGtm('gtm-ab12cd')).toBe('GTM-AB12CD');
  });
  it('valida depois de normalizar; vazio é ok', () => {
    expect(erroGa4('g-ab12cd34ef')).toBeNull();
    expect(erroGa4('UA-123')).toMatch(/G-/);
    expect(erroPixel('abc')).toMatch(/números/);
    expect(erroGtm('')).toBeNull();
    expect(erroGtm('GT-123')).toMatch(/GTM-/);
  });
});
