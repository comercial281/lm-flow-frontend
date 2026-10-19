import { trocarUuidsPorCodigo } from '@/features/links/codigoDoLink';

// Endereço do card completo (página da Parte 4, rota /pipelines/:pipelineId/card/:itemId).
// A setinha do quadro, o "Abrir em nova guia", o "Copiar link" e a página usam este.
export const linkDoCardCompleto = (pipelineId: string, itemId: string): string =>
  `/pipelines/${encodeURIComponent(pipelineId)}/card/${encodeURIComponent(itemId)}`;

// O link pra colar fora (WhatsApp) leva o código no lugar do UUID: o WhatsApp lê
// UUID como chave Pix e o link para de abrir (features/links/codigoDoLink.ts).
export const linkAbsolutoDoCard = (pipelineId: string, itemId: string): string =>
  `${window.location.origin}${trocarUuidsPorCodigo(linkDoCardCompleto(pipelineId, itemId))}`;
