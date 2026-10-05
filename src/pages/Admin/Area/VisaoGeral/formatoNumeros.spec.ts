import { describe, it, expect } from 'vitest';
import { atualizadoHa, periodoValido, rotuloDoBalde, variacao } from './formatoNumeros';

describe('formatoNumeros', () => {
  it('período inválido cai em 7d', () => {
    expect(periodoValido('hoje')).toBe('hoje');
    expect(periodoValido('xyz')).toBe('7d');
    expect(periodoValido(null)).toBe('7d');
  });

  it('variação contra o período anterior', () => {
    expect(variacao(12, 10)).toEqual({ texto: '+20%', sentido: 'sobe' });
    expect(variacao(5, 10)).toEqual({ texto: '-50%', sentido: 'desce' });
    expect(variacao(10, 10)).toEqual({ texto: '0%', sentido: 'igual' });
    expect(variacao(3, 0)).toEqual({ texto: 'novo', sentido: 'sobe' });
    expect(variacao(0, 0)).toBeNull();
    expect(variacao(null, 4)).toBeNull();
  });

  it('rótulo do balde do gráfico', () => {
    expect(rotuloDoBalde('2026-10-15', 'day')).toBe('15/10');
    expect(rotuloDoBalde('2026-10-15T09:00', 'hour')).toBe('9h');
  });

  it('atualizado há', () => {
    const agora = new Date('2026-10-15T15:00:00Z');
    expect(atualizadoHa('2026-10-15T14:59:40Z', agora)).toBe('Atualizado agora');
    expect(atualizadoHa('2026-10-15T14:57:00Z', agora)).toBe('Atualizado há 3 min');
  });
});
