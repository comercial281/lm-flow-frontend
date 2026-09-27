// Ações do cabeçalho do quadro do funil: a função ligada no cliente E o cargo.
// Cada botão responde pelas chaves que o servidor confere no que ele faz — o
// que o servidor recusaria some, e o que ele aceita fica.
//
// - Importar: o modal do quadro cria o contato e o card no funil
//   (`contacts.create` + `pipeline_items.create`), NÃO chama o importador de
//   Contatos (`contacts.import`). O Corretor tem as duas e continua importando.
// - Exportar: pela chave da tela de Contatos (`contacts.export`). Gera o CSV no
//   navegador; sumir para o Corretor foi escolha do dono (26/09/2026).
// - Disparo em massa: pela criação de disparo.
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
    import: features.import && can('contacts', 'create') && can('pipeline_items', 'create'),
    export: features.export && can('contacts', 'export'),
    bulkDispatch: features.bulkDispatch && can('broadcasts', 'create'),
  };
}
