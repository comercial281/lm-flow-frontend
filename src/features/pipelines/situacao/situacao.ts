// Situação do card (Aberto · Ganho · Perdido), separada da etapa — spec do
// funil (07/10/2026) §3. Regras puras: os componentes da situação só desenham
// o que sai daqui.
import { data } from '@/lib/formato';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { PipelineItem, PipelineItemStatus } from '@/types/analytics';

type ComSituacao = Pick<PipelineItem, 'status' | 'won_at' | 'lost_at' | 'lost_reason'>;

export const NOME_DA_SITUACAO: Record<PipelineItemStatus, string> = {
  open: 'Aberto',
  won: 'Ganho',
  lost: 'Perdido',
};

/** Card sem o campo (payload guardado no navegador de antes da entrega) conta como aberto. */
export function situacaoDe(item: Partial<Pick<PipelineItem, 'status'>> | null | undefined): PipelineItemStatus {
  return item?.status === 'won' || item?.status === 'lost' ? item.status : 'open';
}

export function cardFechado(item: Partial<Pick<PipelineItem, 'status'>> | null | undefined): boolean {
  return situacaoDe(item) !== 'open';
}

/**
 * O que Ganho · Perdido · Reabrir muda no card. A resposta da rota de situação
 * é serializada sem os dados do quadro (Roleta, Origem, última mensagem vêm
 * nulos), então só estes campos passam da resposta para o card da tela.
 */
const CAMPOS_DA_SITUACAO = [
  'status',
  'status_changed_at',
  'won_at',
  'lost_at',
  'lost_reason',
  'lost_note',
  'stage_id',
  'pipeline_stage_id',
  'archived_at',
  'completed_at',
  'days_in_pipeline',
  'days_in_current_stage',
  'updated_at',
] as const satisfies readonly (keyof PipelineItem)[];

/** Só os campos da situação que vieram na resposta (campo ausente não apaga o do card). */
export function camposDaSituacao(resposta: Partial<PipelineItem> | null | undefined): Partial<PipelineItem> {
  const campos: Record<string, unknown> = {};
  if (!resposta) return campos as Partial<PipelineItem>;
  for (const campo of CAMPOS_DA_SITUACAO) {
    if (Object.prototype.hasOwnProperty.call(resposta, campo)) campos[campo] = resposta[campo];
  }
  return campos as Partial<PipelineItem>;
}

/** O card da tela com a situação nova da resposta por cima. */
export function comSituacaoNova<T extends Partial<PipelineItem>>(card: T, resposta: Partial<PipelineItem> | null | undefined): T {
  return { ...card, ...camposDaSituacao(resposta) };
}

/** Por que a Etapa não muda num card fechado (decisão: reabrir antes). */
export const ETAPA_TRAVADA = 'Lead fechado não muda de etapa. Reabra para mexer.';

/**
 * A coluna Concluído do funil é a de tipo "Concluída" (ajuste de 08/10): marcar
 * Ganho leva o card para ela, e escolher ou soltar o card nela marca Ganho. O
 * nome da coluna não conta.
 */
export function ehColunaDeGanho(etapa: { stage_type?: string | null } | null | undefined): boolean {
  return etapa?.stage_type === 'completed';
}

/** O texto do selo ao passar o mouse: "Perdido em 05/10/2026 · Adiou a compra". */
export function detalheDaSituacao(item: Partial<ComSituacao> | null | undefined): string | null {
  const situacao = situacaoDe(item);
  if (situacao === 'open') return null;
  const quando = situacao === 'won' ? item?.won_at : item?.lost_at;
  const partes = [quando ? `${NOME_DA_SITUACAO[situacao]} em ${data(quando)}` : NOME_DA_SITUACAO[situacao]];
  if (situacao === 'lost' && item?.lost_reason?.label) partes.push(item.lost_reason.label);
  return partes.join(' · ');
}

/**
 * A frase da recusa do servidor. A rota de situação usa o envelope da casa
 * (`{ success: false, error: { code, message } }`, frase em PT pronta pra
 * tela); a frase solta em `error` também é lida, por tolerância.
 */
export function mensagemDaRecusa(erro: unknown, reserva: string): string {
  const corpo = (erro as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  if (typeof corpo?.error === 'string' && corpo.error.trim()) return corpo.error.trim();
  return apiErrorMessage(erro, reserva);
}
