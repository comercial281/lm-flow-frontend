// Ações do ⋯ do quadro do funil: a função ligada no cliente E o cargo. Cada
// item responde pelas chaves que o servidor confere no que ele faz — o que o
// servidor recusaria some, e o que ele aceita fica.
//
// - Exportar: pela chave da tela de Contatos (`contacts.export`). Gera o CSV no
//   navegador; sumir para o Corretor foi escolha do dono (26/09/2026).
// - Disparo em massa: pela criação de disparo.
// - Importar saiu do funil em 07/10/2026 (spec funil §4.1). O Bolsão continua
//   com o importador dele, preso às regras dele.
export interface BoardActionFlags {
  export: boolean;
  bulkDispatch: boolean;
}

export function boardHeaderActions(
  features: BoardActionFlags,
  can: (resource: string, action: string) => boolean,
): BoardActionFlags {
  return {
    export: features.export && can('contacts', 'export'),
    bulkDispatch: features.bulkDispatch && can('broadcasts', 'create'),
  };
}
