// O card pelo id (GET de um card, E4) — a página do card e o quadro (link
// ?card= de card fora da aba) leem por aqui.
import { pipelinesService } from '@/services/pipelines';
import type { PipelineItemDetail } from '@/types/analytics';

export const SEM_ACESSO_AO_CARD = 'Você não tem acesso a este lead';

export type ResultadoDaBusca =
  | { tipo: 'achou'; card: PipelineItemDetail }
  | { tipo: 'sem-acesso' }
  | { tipo: 'erro' };

/**
 * 404 e 403 são "sem acesso": o servidor responde 404 igual para card de outro
 * dono, apagado ou de outro funil, de propósito — a tela não diz qual dos três.
 * Qualquer outra falha é erro (com "Tentar de novo"), nunca "sem acesso".
 */
export async function buscarCardPeloId(pipelineId: string, itemId: string): Promise<ResultadoDaBusca> {
  try {
    return { tipo: 'achou', card: await pipelinesService.getPipelineItem(pipelineId, itemId) };
  } catch (erro) {
    const status = (erro as { response?: { status?: number } } | null)?.response?.status;
    return status === 404 || status === 403 ? { tipo: 'sem-acesso' } : { tipo: 'erro' };
  }
}
