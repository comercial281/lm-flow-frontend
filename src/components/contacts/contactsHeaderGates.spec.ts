import { describe, it, expect } from 'vitest';
import { contactsHeaderGates } from './contactsHeaderGates';

const ff = { import: true, export: true, create: true, delete: true, merge: true };
const corretor = (r: string, a: string) => ['contacts.read', 'contacts.create', 'contacts.update'].includes(`${r}.${a}`);

describe('ações do cabeçalho de Contatos', () => {
  it('o Corretor cria e mescla, mas não importa, exporta nem apaga', () => {
    expect(contactsHeaderGates(ff, true, corretor)).toEqual({
      create: true, export: false, import: false, merge: true, delete: false,
    });
  });

  it('antes das permissões carregarem, nada aparece', () => {
    expect(contactsHeaderGates(ff, false, () => true)).toEqual({
      create: false, export: false, import: false, merge: false, delete: false,
    });
  });
});
