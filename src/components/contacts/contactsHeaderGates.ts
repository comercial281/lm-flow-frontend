// Botões do cabeçalho de Contatos: função do cliente + cargo + permissões
// carregadas. Exportar pedia só `contacts.read` e Importar `contacts.create` —
// o Corretor via os dois e o servidor recusava a exportação.
export interface ContactsHeaderFlags {
  import: boolean;
  export: boolean;
  create: boolean;
  delete: boolean;
  merge: boolean;
}

export function contactsHeaderGates(
  ff: ContactsHeaderFlags,
  ready: boolean,
  can: (resource: string, action: string) => boolean,
): ContactsHeaderFlags {
  return {
    create: ff.create && ready && can('contacts', 'create'),
    export: ff.export && ready && can('contacts', 'export'),
    import: ff.import && ready && can('contacts', 'import'),
    merge: ff.merge && ready && can('contacts', 'update'),
    delete: ff.delete && ready && can('contacts', 'delete'),
  };
}
