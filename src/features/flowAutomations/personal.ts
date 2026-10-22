// REGRAS DA AUTOMAÇÃO PESSOAL DO CORRETOR (espelho da política do servidor).
//
// O servidor é quem manda; aqui só decidimos o que mostrar, o que deixar
// cinza ("Indisponível") e o que esconder no construtor do corretor.

import { useCan } from '@/hooks/useCan';
import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
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
  } else if (!(PERSONAL_NATIVE_KINDS as string[]).includes(key)) {
    return 'fora';
  }
  return personalAvailabilityState(item, ctx);
}

/**
 * Só o "tem número / tem IA", sem a lista do cargo: a automação pessoal do
 * GESTOR (ele tem todos os blocos, mas a mensagem sai pelo número dele).
 */
export function personalAvailabilityState(
  item: PaletteItem,
  ctx: { temNumero: boolean; temIA: boolean },
): 'ok' | 'indisponivel' {
  const key = item.key;
  if (key.startsWith('lead_action:')) {
    const type = key.slice('lead_action:'.length);
    const mandaMensagem = MESSAGE_ACTIONS.has(type) || type.startsWith('send_');
    return mandaMensagem && !ctx.temNumero ? 'indisponivel' : 'ok';
  }
  if (key === 'send_whatsapp') return ctx.temNumero ? 'ok' : 'indisponivel';
  if (key === 'hand_to_ai') return ctx.temIA ? 'ok' : 'indisponivel';
  return 'ok';
}

/**
 * Como o construtor trata a automação aberta:
 * - 'corretor': a pessoal do corretor (lista do cargo + número e IA dele);
 * - 'dono': a pessoal de quem não é corretor e é o dono (todos os blocos, mas
 *   a mensagem sai pelo número dele: "Indisponível" sem número ou sem IA);
 * - 'de_outro': a pessoal de outra pessoa aberta pelo gestor (o servidor manda
 *   pelo número do dono; a tela só avisa, sem escolha de número);
 * - null: da equipe (ou sem a informação), como sempre.
 */
export type ModoPessoal = 'corretor' | 'dono' | 'de_outro' | null;

export function modoPessoal(
  flow: Pick<FlowAutomation, 'permissions' | 'owner_user_id'> | null | undefined,
  ctx: { ehCorretor: boolean; meId: string },
): ModoPessoal {
  if (!flow || !isPersonalFlow(flow)) return null;
  if (ctx.ehCorretor) return 'corretor';
  const dono = flow.owner_user_id == null ? '' : String(flow.owner_user_id);
  return dono !== '' && dono === ctx.meId ? 'dono' : 'de_outro';
}

/** A linha do bloco de mensagem na pessoal de outra pessoa. */
export function saiPeloWhatsAppDe(nome: string | null | undefined): string {
  const quem = nome?.trim();
  return quem ? `Sai pelo WhatsApp de ${quem}` : 'Sai pelo WhatsApp do dono';
}

/** Mesmo texto do 422 do servidor ao tirar "Da equipe". */
export const NUMERO_FIXO_NA_EQUIPE =
  'Esta automação manda por um número específico. Pra virar pessoal, troque o número nos blocos.';

/** Entrega 4: com o número escolhido nas Configurações do fluxo, a troca é lá. */
export const NUMERO_FIXO_NO_FLUXO =
  'Esta automação manda por um número específico. Pra virar pessoal, troque o número nas Configurações do fluxo.';

/** O texto da trava de "Da equipe": aponta pra onde o número específico mora. */
export function numeroFixoNaEquipe(flow: Pick<FlowAutomation, 'send_from'>): string {
  return flow.send_from === 'number' ? NUMERO_FIXO_NO_FLUXO : NUMERO_FIXO_NA_EQUIPE;
}

/** Da equipe com bloco preso a número específico: "Da equipe" não sai (o servidor diz). */
export function presaNaEquipe(flow: Pick<FlowAutomation, 'permissions'>): boolean {
  return !isPersonalFlow(flow) && flow.permissions?.fixed_number === true;
}

export function isPersonalFlow(flow: Pick<FlowAutomation, 'permissions'>): boolean {
  return flow.permissions?.personal === true;
}

/** Corretor: edita só o que é dele, não gerencia automações de todos. */
export function useEhCorretorDeAutomacao(): boolean {
  const can = useCan();
  return !can('flow_automations', 'update') && can('flow_automations', 'own');
}

/**
 * A pergunta antes de tirar "Da equipe" (lista e construtor). Sem dono ou dona
 * de quem tira: a automação passa a ser dele. Com outro dono: fica do dono.
 */
export function tirarDaEquipe(
  flow: Pick<FlowAutomation, 'owner_user_id' | 'owner_name'>,
  meId: string,
): PedidoDeConfirmacao {
  const dono = flow.owner_user_id == null || String(flow.owner_user_id) === '' ? null : String(flow.owner_user_id);
  const deOutro = dono !== null && dono !== meId;
  const nome = flow.owner_name?.trim();
  const deQuem = nome ? `de ${nome}` : 'do dono';
  return {
    titulo: 'Tirar da equipe?',
    descricao: deOutro
      ? `Esta automação passa a valer só pros leads ${deQuem} e a mandar pelo WhatsApp ${deQuem}.`
      : 'Esta automação passa a valer só pros seus leads e a mandar pelo seu WhatsApp.',
    rotuloDaAcao: 'Tirar da equipe',
  };
}
