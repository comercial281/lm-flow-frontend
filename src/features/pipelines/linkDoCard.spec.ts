// src/features/pipelines/linkDoCard.spec.ts
import { describe, expect, it } from 'vitest';
import { linkAbsolutoDoCard, linkDoCardCompleto } from './linkDoCard';

describe('link do card completo', () => {
  it('o endereço da página do card (Parte 4)', () => {
    expect(linkDoCardCompleto('p1', 'i1')).toBe('/pipelines/p1/card/i1');
    expect(linkAbsolutoDoCard('p1', 'i1')).toBe(`${window.location.origin}/pipelines/p1/card/i1`);
  });

  it('o "Copiar link" leva o código no lugar do UUID (o WhatsApp lê UUID como chave Pix)', () => {
    const funil = '829a6b1e-8259-4c3d-9e2f-0a1b2c3d4e5f';
    const card = '0b6f5c1a-3d2e-4f10-8a9b-c7d6e5f40312';
    expect(linkAbsolutoDoCard(funil, card))
      .toBe(`${window.location.origin}/pipelines/H8PhzFPbgreJefMBgig7ux/card/2Qu7ReJ5bTo99bHR2atWs3`);
    // Dentro do app o endereço segue com UUID.
    expect(linkDoCardCompleto(funil, card)).toBe(`/pipelines/${funil}/card/${card}`);
  });
});
