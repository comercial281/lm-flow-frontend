// src/services/properties/opcoesDeTipoDeImovel.spec.ts
import { describe, expect, it } from 'vitest';
import { opcoesDeTipoDeImovel } from './propertiesService';

const nomes = (atual?: string) => opcoesDeTipoDeImovel(atual).map(([, l]) => l);
const codigos = (atual?: string) => opcoesDeTipoDeImovel(atual).map(([v]) => v);

describe('opcoesDeTipoDeImovel', () => {
  it('não repete nome (Cobertura, Sala Comercial, Galpão e Terreno apareciam duas vezes)', () => {
    const lista = nomes();
    expect(new Set(lista).size).toBe(lista.length);
    expect(lista).not.toContain('Terreno');
    expect(lista).toContain('Lote/Terreno');
  });

  it('oferece os códigos que a importação grava', () => {
    expect(codigos()).toEqual(expect.arrayContaining(['penthouse', 'commercial_room', 'warehouse', 'lot']));
    expect(codigos()).not.toEqual(expect.arrayContaining(['cobertura']));
  });

  it('imóvel salvo com o código nativo continua marcado, sem repetir o nome', () => {
    const lista = codigos('galpao');
    expect(lista).toContain('galpao');
    expect(lista).not.toContain('warehouse');
    expect(new Set(nomes('galpao')).size).toBe(nomes('galpao').length);
  });
});
