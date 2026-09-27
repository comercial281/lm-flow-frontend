import { describe, it, expect } from 'vitest';
import { propertiesActionGates } from './propertiesActionGates';

const cargo = (chaves: string[]) => (r: string, a: string) => chaves.includes(`${r}.${a}`);

describe('ações da tela de Imóveis', () => {
  it('esconde Cadastrar e Excluir de quem não tem o cargo', () => {
    expect(propertiesActionGates(true, cargo(['properties.read']))).toEqual({
      create: false,
      delete: false,
    });
  });

  it('mostra as duas para quem tem o cargo', () => {
    expect(propertiesActionGates(true, cargo(['properties.create', 'properties.delete']))).toEqual({
      create: true,
      delete: true,
    });
  });

  it('a função desligada no cliente esconde Cadastrar mesmo com o cargo', () => {
    const tudo = () => true;
    expect(propertiesActionGates(false, tudo)).toEqual({
      create: false,
      delete: true,
    });
  });
});
