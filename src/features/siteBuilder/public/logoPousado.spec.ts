import { describe, expect, it } from 'vitest';
import { FOLGA_DO_POUSO, estaPousado } from './logoPousado';

describe('estaPousado', () => {
  it('pousa quando o topo do logo da capa chega na base do topo do site (com a folga)', () => {
    expect(estaPousado(300, 84)).toBe(false);
    expect(estaPousado(84 + FOLGA_DO_POUSO + 1, 84)).toBe(false);
    expect(estaPousado(84 + FOLGA_DO_POUSO, 84)).toBe(true);
    expect(estaPousado(-200, 84)).toBe(true);
  });

  it('sem logo da capa na tela, conta como pousado: o topo nunca fica sem marca', () => {
    expect(estaPousado(null, 84)).toBe(true);
  });
});
