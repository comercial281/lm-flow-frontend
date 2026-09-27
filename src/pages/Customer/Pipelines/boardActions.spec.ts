import { describe, it, expect } from 'vitest';
import { boardHeaderActions } from './boardActions';

const ligado = { import: true, export: true, bulkDispatch: true };
const cargo = (chaves: string[]) => (r: string, a: string) => chaves.includes(`${r}.${a}`);

describe('ações do cabeçalho do quadro do funil', () => {
  it('o Corretor (cria contato e card) vê Importar, mas não Exportar nem Disparo em massa', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.read', 'contacts.create', 'pipeline_items.create']))).toEqual({
      import: true, export: false, bulkDispatch: false,
    });
  });

  it('sem pipeline_items.create o Importar some (o servidor recusaria o card)', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.read', 'contacts.create'])).import).toBe(false);
  });

  it('sem contacts.create o Importar some, mesmo com contacts.import', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.import', 'pipeline_items.create'])).import).toBe(false);
  });

  it('o Gerente vê as três', () => {
    expect(boardHeaderActions(ligado, cargo([
      'contacts.create', 'pipeline_items.create', 'contacts.export', 'broadcasts.create',
    ]))).toEqual({
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
