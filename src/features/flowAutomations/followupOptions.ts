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

export const FOLLOWUP_PADRAO_NOME = 'Follow-up padrão';

type FluxoParaPadrao = Pick<FlowAutomation, 'id' | 'name' | 'is_enabled' | 'archived_at'>
  & Partial<Pick<FlowAutomation, 'followup_padrao' | 'created_at'>>;

/**
 * Qual fluxo já vem escolhido quando a pessoa marca "Entregar pro follow-up" sem
 * nenhum escolhido: o Follow-up padrão do cliente.
 *
 * O servidor marca o padrão com `followup_padrao` (o mesmo que ele usa pra IA
 * nova). ⚠️ NÃO pelo `template_key`: todo "Novo follow-up" nasce com o modelo
 * 'follow_up_padrao', e isso escolheria o "Pós-visita" de alguém. Sem a marca, o
 * de nome exato "Follow-up padrão"; senão, o primeiro ligado; nenhum: null (a
 * escolha fica vazia). Entre vários, o ligado e depois o mais antigo. Arquivado
 * nunca entra.
 */
export function followupPadraoId(list: FluxoParaPadrao[]): string | null {
  const vivos = list.filter((f) => !f.archived_at);
  const melhor = (candidatos: FluxoParaPadrao[]) =>
    [...candidatos].sort((a, b) =>
      Number(b.is_enabled) - Number(a.is_enabled) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
    )[0] ?? null;
  const marcado = melhor(vivos.filter((f) => f.followup_padrao === true));
  if (marcado) return marcado.id;
  const porNome = melhor(vivos.filter((f) => f.name.trim() === FOLLOWUP_PADRAO_NOME));
  if (porNome) return porNome.id;
  return vivos.find((f) => f.is_enabled)?.id ?? null;
}
