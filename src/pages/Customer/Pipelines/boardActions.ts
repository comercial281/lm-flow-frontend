// Ações do cabeçalho do quadro do funil: a função ligada no cliente E o cargo.
// Importar/Exportar respondem pelas mesmas chaves da tela de Contatos, e
// Disparo em massa pela criação de disparo — o que o servidor recusaria some.
export interface BoardActionFlags {
  import: boolean;
  export: boolean;
  bulkDispatch: boolean;
}

export function boardHeaderActions(
  features: BoardActionFlags,
  can: (resource: string, action: string) => boolean,
): BoardActionFlags {
  return {
    import: features.import && can('contacts', 'import'),
    export: features.export && can('contacts', 'export'),
    bulkDispatch: features.bulkDispatch && can('broadcasts', 'create'),
  };
}
