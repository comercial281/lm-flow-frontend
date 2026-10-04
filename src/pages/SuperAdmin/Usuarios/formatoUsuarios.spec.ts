import { describe, it, expect } from 'vitest';
import { duracao } from './formatoUsuarios';

describe('duracao', () => {
  it('formata minutos e horas', () => {
    expect(duracao(720)).toBe('12 min');
    expect(duracao(4800)).toBe('1 h 20 min');
    expect(duracao(3600)).toBe('1 h');
  });
  it('menos de um minuto não vira traço', () => {
    expect(duracao(30)).toBe('< 1 min');
    expect(duracao(59)).toBe('< 1 min');
  });
  it('zero e nulo viram traço', () => {
    expect(duracao(0)).toBe('—');
    expect(duracao(null)).toBe('—');
  });
});
