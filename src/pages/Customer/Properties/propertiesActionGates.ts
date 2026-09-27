// Ações da tela de Imóveis: cadastrar e excluir agora respeitam o cargo, não
// só a função ligada no cliente. Cadastrar já tinha a chave de feature
// (`properties_create`); Excluir não tinha gate nenhum — todo mundo que abria
// a tela via o botão no card, mesmo sem `properties.delete`.
export interface PropertiesActionFlags {
  create: boolean;
  delete: boolean;
}

export function propertiesActionGates(
  featureCreate: boolean,
  can: (resource: string, action: string) => boolean,
): PropertiesActionFlags {
  return {
    create: featureCreate && can('properties', 'create'),
    delete: can('properties', 'delete'),
  };
}
