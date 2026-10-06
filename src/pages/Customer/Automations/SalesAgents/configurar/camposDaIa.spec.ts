import { describe, expect, it } from 'vitest';
import { CAMPOS_DE_ENSINAR, CAMPOS_ESCONDIDOS, RAIZES_DIVIDIDAS } from './camposDaIa';

// Os campos de cada página são conferidos no paginas.spec.ts. Aqui só o que vale
// pra IA inteira: o Ensinar grava os dele, e nada escondido é raiz dividida inteira.
describe('camposDaIa', () => {
  it('o Ensinar não grava nada que saiu da tela', () => {
    for (const campo of CAMPOS_DE_ENSINAR) expect(CAMPOS_ESCONDIDOS).not.toContain(campo);
  });

  it('nenhum campo escondido é uma raiz dividida inteira (ela seria zerada junto)', () => {
    const divididas: readonly string[] = RAIZES_DIVIDIDAS;
    for (const campo of CAMPOS_ESCONDIDOS) expect(divididas).not.toContain(campo);
  });
});
