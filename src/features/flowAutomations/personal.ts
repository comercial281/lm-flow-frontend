// REGRAS DA AUTOMAÇÃO PESSOAL DO CORRETOR (espelho da política do servidor).
//
// O servidor é quem manda; aqui só decidimos o que mostrar, o que deixar
// cinza ("Indisponível") e o que esconder no construtor do corretor.

import { useCan } from '@/hooks/useCan';
import type { FlowAutomation, FlowNodeKind, FlowTriggerEvent } from '@/types/flowAutomations';
import type { PaletteItem } from './palette';
import type { FlowTriggerGroup } from './trigger';

export const INDISPONIVEL = 'Indisponível';
export const SAI_PELO_SEU = 'Sai pelo seu WhatsApp';

export const PERSONAL_TRIGGERS: FlowTriggerEvent[] = [
  'lead.created',
  'lead.roleta_accepted',
  'lead.campaign_received',
  'lead.message_received',
  'lead.stage_changed',
  'lead.tag_added',
  'lead.visit_scheduled',
  'lead.visit_rescheduled',
  'lead.visit_completed',
  'lead.visit_reminder_24h',
  'lead.visit_reminder_1h',
  'lead.visit_reminder_15min',
  'lead.interest_created',
  'lead.book_requested',
] as FlowTriggerEvent[];

export const PERSONAL_NATIVE_KINDS: FlowNodeKind[] = [
  'send_whatsapp',
  'wait',
  'wait_for_reply',
  'condition',
  'filter_label',
  'add_label',
  'remove_label',
  'move_stage',
  'hand_to_ai',
  'disable_ai',
] as FlowNodeKind[];

export const PERSONAL_LEAD_ACTIONS: string[] = [
  'send_whatsapp_message',
  'send_audio',
  'send_image',
  'send_video',
  'send_document',
  'send_sticker',
  'send_quick_reply',
  'send_message_funnel',
  'add_label',
  'remove_label',
  'move_pipeline_stage',
  'create_task',
  'start_followup_flow',
];

// Ações que saem pelo número do dono.
const MESSAGE_ACTIONS = new Set([
  'send_whatsapp_message',
  'send_audio',
  'send_image',
  'send_video',
  'send_document',
  'send_sticker',
  'send_quick_reply',
  'send_message_funnel',
  'start_followup_flow',
]);

/** Filtra os eventos permitidos pro corretor e tira o grupo que ficou vazio. */
export function personalTriggerGroups(groups: FlowTriggerGroup[]): FlowTriggerGroup[] {
  const allowed = new Set<string>(PERSONAL_TRIGGERS);
  return groups
    .map(g => ({ ...g, events: g.events.filter(e => allowed.has(e)) }))
    .filter(g => g.events.length > 0);
}

export function personalBlockState(
  item: PaletteItem,
  ctx: { temNumero: boolean; temIA: boolean },
): 'ok' | 'indisponivel' | 'fora' {
  const key = item.key;
  if (key.startsWith('lead_action:')) {
    const type = key.slice('lead_action:'.length);
    if (!PERSONAL_LEAD_ACTIONS.includes(type)) return 'fora';
    return MESSAGE_ACTIONS.has(type) && !ctx.temNumero ? 'indisponivel' : 'ok';
  }
  if (!(PERSONAL_NATIVE_KINDS as string[]).includes(key)) return 'fora';
  if (key === 'send_whatsapp') return ctx.temNumero ? 'ok' : 'indisponivel';
  if (key === 'hand_to_ai') return ctx.temIA ? 'ok' : 'indisponivel';
  return 'ok';
}

export function isPersonalFlow(flow: Pick<FlowAutomation, 'permissions'>): boolean {
  return flow.permissions?.personal === true;
}

/** Corretor: edita só o que é dele, não gerencia automações de todos. */
export function useEhCorretorDeAutomacao(): boolean {
  const can = useCan();
  return !can('flow_automations', 'update') && can('flow_automations', 'own');
}
