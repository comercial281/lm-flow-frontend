// src/features/pipelines/linkDoCard.spec.ts
import { describe, expect, it } from 'vitest';
import { linkAbsolutoDoCard, linkDoCardCompleto } from './linkDoCard';

describe('link do card completo', () => {
  it('o endereço da página do card (Parte 4)', () => {
    expect(linkDoCardCompleto('p1', 'i1')).toBe('/pipelines/p1/card/i1');
    expect(linkAbsolutoDoCard('p1', 'i1')).toBe(`${window.location.origin}/pipelines/p1/card/i1`);
  });
});
