import { describe, expect, it } from 'vitest';
import { tituloDaAba } from './tituloDaAba';

describe('tituloDaAba', () => {
  it('usa o título de Aparecer no Google quando há', () => {
    expect(tituloDaAba('Imob XYZ | Imóveis em Campinas', 'Imob XYZ')).toBe('Imob XYZ | Imóveis em Campinas');
  });
  it('sem título, usa o nome do site com a frase padrão', () => {
    expect(tituloDaAba('', 'Imob XYZ')).toBe('Imob XYZ — Encontre seu imóvel');
    expect(tituloDaAba(null, '')).toBe('Imóveis — Encontre seu imóvel');
  });
});
