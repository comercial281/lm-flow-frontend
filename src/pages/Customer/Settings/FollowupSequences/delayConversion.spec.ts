import { describe, it, expect } from 'vitest';
import { pickUnit, unitFactor } from './delayConversion';

describe('unidade mostrada na tela', () => {
  it('mostra dias quando o número é redondo em dias', () => {
    expect(pickUnit(10080)).toBe('d');
    expect(pickUnit(1440)).toBe('d');
  });

  it('mostra horas quando é redondo em horas', () => {
    expect(pickUnit(120)).toBe('h');
  });

  it('cai pra minutos no resto — e no zero', () => {
    expect(pickUnit(90)).toBe('min');
    expect(pickUnit(0)).toBe('min');
  });
});

describe('fator da unidade', () => {
  it('minutos por unidade', () => {
    expect([unitFactor('min'), unitFactor('h'), unitFactor('d')]).toEqual([1, 60, 1440]);
  });
});
