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
