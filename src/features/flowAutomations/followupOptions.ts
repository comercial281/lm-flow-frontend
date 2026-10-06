// OS FOLLOW-UPS PRA ESCOLHER (Automações · sprint 3, spec 03/10/2026).
//
// A IA Vendedora ("Entregar pro follow-up") e o assistente da IA escolhem um
// fluxo de follow-up, não mais um funil antigo. Lista os não arquivados; o
// desligado aparece com "(desligado)", porque desligado ele não recebe o lead.

import type { FlowAutomation } from '@/types/flowAutomations';

export interface FollowupFlowOption {
  value: string;
  label: string;
}

export function followupFlowOptions(list: Array<Pick<FlowAutomation, 'id' | 'name' | 'is_enabled' | 'archived_at'>>): FollowupFlowOption[] {
  return list
    .filter(f => !f.archived_at)
    .map(f => ({ value: f.id, label: f.is_enabled ? f.name : `${f.name} (desligado)` }));
}

/** A IA ainda aponta pro funil antigo (só o slug)? A frase que a tela mostra, ou null. */
export function legacySequenceNotice(agent: { followup_flow_id?: string | null; followup_sequence_slug?: string | null }): string | null {
  if (agent.followup_flow_id || !agent.followup_sequence_slug) return null;
  return `Hoje ela entrega pro funil antigo "${agent.followup_sequence_slug}". Se ele já foi convertido, o lead vai pro follow-up novo dele. Escolha aqui o follow-up pra deixar isso claro.`;
}

/** O modelo do Follow-up padrão de 30 dias (servidor: `Templates`, 06/10/2026). */
export const FOLLOWUP_PADRAO_TEMPLATE_KEY = 'follow_up_padrao';
export const FOLLOWUP_PADRAO_NOME = 'Follow-up padrão';

type FluxoParaPadrao = Pick<FlowAutomation, 'id' | 'name' | 'is_enabled' | 'archived_at'>
  & Partial<Pick<FlowAutomation, 'template_key' | 'created_at'>>;

/**
 * Qual fluxo já vem escolhido quando a pessoa marca "Entregar pro follow-up" sem
 * nenhum escolhido: o Follow-up padrão do cliente.
 *
 * Mesma régua do servidor pra IA nova (o mais antigo ligado com o modelo
 * 'follow_up_padrao'); sem o modelo, o de nome exato "Follow-up padrão" (cliente
 * que recriou à mão); senão, o primeiro ligado. Nenhum: null (a escolha fica vazia).
 * Arquivado nunca entra.
 */
export function followupPadraoId(list: FluxoParaPadrao[]): string | null {
  const vivos = list.filter((f) => !f.archived_at);
  const melhor = (candidatos: FluxoParaPadrao[]) =>
    [...candidatos].sort((a, b) =>
      Number(b.is_enabled) - Number(a.is_enabled) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
    )[0] ?? null;
  const porModelo = melhor(vivos.filter((f) => f.template_key === FOLLOWUP_PADRAO_TEMPLATE_KEY));
  if (porModelo) return porModelo.id;
  const porNome = melhor(vivos.filter((f) => f.name.trim() === FOLLOWUP_PADRAO_NOME));
  if (porNome) return porNome.id;
  return vivos.find((f) => f.is_enabled)?.id ?? null;
}
