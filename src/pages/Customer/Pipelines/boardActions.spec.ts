import { describe, it, expect } from 'vitest';
import { boardHeaderActions } from './boardActions';

const ligado = { export: true, bulkDispatch: true };
const cargo = (chaves: string[]) => (r: string, a: string) => chaves.includes(`${r}.${a}`);

describe('ações do ⋯ do quadro do funil', () => {
  it('o Corretor (sem contacts.export nem broadcasts.create) não vê Exportar nem Disparo em massa', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.read', 'contacts.create', 'pipeline_items.create']))).toEqual({
      export: false, bulkDispatch: false,
    });
  });

  it('o Gerente vê as duas', () => {
    expect(boardHeaderActions(ligado, cargo(['contacts.export', 'broadcasts.create']))).toEqual({
      export: true, bulkDispatch: true,
    });
  });

  it('a função desligada no cliente continua escondendo, mesmo com o cargo', () => {
    expect(boardHeaderActions({ export: false, bulkDispatch: false }, () => true)).toEqual({
      export: false, bulkDispatch: false,
    });
  });

  // Spec funil §4.1 (07/10): Importar saiu do funil (o Bolsão continua).
  it('Importar não existe mais no quadro', () => {
    expect(Object.keys(boardHeaderActions(ligado, () => true))).toEqual(['export', 'bulkDispatch']);
  });
});
