import { describe, it, expect } from 'vitest';
import { quandoFoi } from './rotulos';

const agora = new Date('2026-10-04T15:00:00-03:00');

describe('quandoFoi', () => {
  it.each([
    ['2026-10-04T14:59:40-03:00', 'agora'],
    ['2026-10-04T14:55:00-03:00', 'há 5 min'],
    ['2026-10-04T12:00:00-03:00', 'há 3 h'],
    ['2026-10-03T20:00:00-03:00', 'ontem'],
    ['2026-09-12T10:00:00-03:00', '12/09'],
  ])('%s → %s', (iso, esperado) => {
    expect(quandoFoi(iso, agora)).toBe(esperado);
  });
});
