import { describe, it, expect } from 'vitest';
import { boardHeaderActions } from './boardActions';

const ligado = { import: true, export: true, bulkDispatch: true };
const cargo = (chaves: string[]) => (r: string, a: string) => chaves.includes(`${r}.${a}`);

describe('ações do cabeçalho do quadro do funil', () => {
  it('o Corretor não vê Importar, Exportar nem Disparo em massa', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.read', 'contacts.create']))).toEqual({
      import: false, export: false, bulkDispatch: false,
    });
  });

  it('o Gerente vê as três', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.import', 'contacts.export', 'broadcasts.create']))).toEqual({
      import: true, export: true, bulkDispatch: true,
    });
  });

  it('a função desligada no cliente continua escondendo, mesmo com o cargo', () => {
    const tudo = () => true;
    expect(boardHeaderActions({ import: false, export: false, bulkDispatch: false }, tudo)).toEqual({
      import: false, export: false, bulkDispatch: false,
    });
  });
});
