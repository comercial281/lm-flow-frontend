// Endereço do card completo (página da Parte 4, rota /pipelines/:pipelineId/card/:itemId).
// A setinha do quadro, o "Abrir em nova guia", o "Copiar link" e a página usam este.
export const linkDoCardCompleto = (pipelineId: string, itemId: string): string =>
  `/pipelines/${encodeURIComponent(pipelineId)}/card/${encodeURIComponent(itemId)}`;

export const linkAbsolutoDoCard = (pipelineId: string, itemId: string): string =>
  `${window.location.origin}${linkDoCardCompleto(pipelineId, itemId)}`;
