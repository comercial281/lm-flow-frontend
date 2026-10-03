// BLOCO "AÇÃO DAS AUTOMAÇÕES" (sprint 2, spec 03/10/2026, seção 2).
//
// Cada ação da tela Automações vira um bloco do construtor, com o kind
// `lead_action` e a config `{ action_type, params }`. O servidor executa pelo
// MESMO LeadAutomation::Executor da regra, e a tela configura com o MESMO
// editor (ActionEditor, em LeadAutomationsEditors.tsx): `params` é exatamente o
// que a regra grava, e as variáveis são as das Automações ({{nome}}…).
//
// Fica de fora só `wait` ("Aguardar (delay)"): o bloco Esperar faz isso de verdade.

import {
  ACTION_TYPE_LABELS,
  RETIRED_ACTION_TYPES,
  missingActionParams,
  type LeadAutomationAction,
} from '@/services/leadAutomation/leadAutomationService';
import type { FlowNodeConfig, FlowNodeGroup } from '@/types/flowAutomations';

/**
 * O nome de cada bloco na paleta e no canvas (tabela da spec). A tela de regras
 * continua com os nomes dela (ACTION_TYPE_LABELS); ação sem nome aqui usa aquele.
 */
export const LEAD_ACTION_BLOCK_LABELS: Record<string, string> = {
  send_whatsapp_message: 'Mandar WhatsApp',
  send_audio: 'Mandar áudio',
  send_image: 'Mandar imagem',
  send_video: 'Mandar vídeo',
  send_document: 'Mandar documento',
  send_sticker: 'Mandar figurinha',
  send_quick_reply: 'Mandar resposta rápida',
  send_message_funnel: 'Disparar funil de mensagens',
  add_label: 'Aplicar etiqueta',
  remove_label: 'Tirar etiqueta',
  move_pipeline_stage: 'Mover de etapa',
  assign_broker: 'Definir corretor',
  assign_via_roleta: 'Distribuir pela roleta',
  create_task: 'Criar tarefa',
  start_followup_sequence: 'Iniciar follow-up',
  notify_group: 'Avisar no grupo',
  notify_user: 'Avisar pessoa',
  notify_broker: 'Avisar corretor',
  notify_gestor: 'Avisar gestor',
  notify_push: 'Notificação no celular',
};

/** Em que grupo da paleta (e com que cor) cada ação aparece. */
export const LEAD_ACTION_GROUP: Record<string, FlowNodeGroup> = {
  send_whatsapp_message: 'message',
  send_audio: 'message',
  send_image: 'message',
  send_video: 'message',
  send_document: 'message',
  send_sticker: 'message',
  send_quick_reply: 'message',
  send_message_funnel: 'message',
  add_label: 'contact',
  remove_label: 'contact',
  move_pipeline_stage: 'contact',
  assign_broker: 'contact',
  assign_via_roleta: 'contact',
  create_task: 'contact',
  start_followup_sequence: 'contact',
  notify_group: 'notify',
  notify_user: 'notify',
  notify_broker: 'notify',
  notify_gestor: 'notify',
  notify_push: 'notify',
};

/**
 * As ações que entram na PALETA, na ordem da spec. Ficam fora as que já têm
 * bloco próprio da sprint 1, que continua sendo o oferecido: Mandar WhatsApp
 * (`send_whatsapp`), Aplicar/Tirar etiqueta (`add_label`/`remove_label`, por
 * título, várias de uma vez) e Mover de etapa (`move_stage`). Um fluxo
 * convertido de regra pode trazer essas ações como `lead_action`: o canvas abre
 * e edita normalmente, elas só não são oferecidas duas vezes na paleta.
 */
export const PALETTE_LEAD_ACTIONS: string[] = [
  'send_audio', 'send_image', 'send_video', 'send_document', 'send_sticker',
  'send_quick_reply', 'send_message_funnel',
  'assign_broker', 'assign_via_roleta', 'create_task', 'start_followup_sequence',
  'notify_group', 'notify_user', 'notify_broker', 'notify_gestor', 'notify_push',
];

/** Ação que o bloco aceita: qualquer uma das Automações, menos as aposentadas. */
export function isLeadActionType(type: unknown): type is string {
  return typeof type === 'string' && type in ACTION_TYPE_LABELS && !RETIRED_ACTION_TYPES.has(type);
}

export function leadActionLabel(type: string): string {
  return LEAD_ACTION_BLOCK_LABELS[type] ?? ACTION_TYPE_LABELS[type] ?? 'Ação';
}

export function leadActionGroup(type: string): FlowNodeGroup {
  return LEAD_ACTION_GROUP[type] ?? 'contact';
}

/** Config do bloco → a ação no formato da regra (o que o ActionEditor edita). */
export function leadActionOf(config: FlowNodeConfig | null | undefined): LeadAutomationAction {
  const params = config?.params;
  return {
    type: typeof config?.action_type === 'string' ? config.action_type : '',
    params: params && typeof params === 'object' && !Array.isArray(params)
      ? (params as Record<string, string | number>)
      : {},
  };
}

/** A ação no formato da regra → config do bloco. */
export function leadActionConfig(action: LeadAutomationAction): FlowNodeConfig {
  return { action_type: action.type, params: { ...(action.params ?? {}) } };
}

/** Config de um bloco novo, tirado da paleta. */
export function newLeadActionConfig(type: string): FlowNodeConfig {
  return { action_type: type, params: {} };
}

// O nome do campo, como a pessoa vê na janela do bloco.
const PARAM_NAMES: Record<string, string> = {
  message: 'a mensagem',
  media_url: 'o endereço do arquivo',
  funnel_id: 'o funil de mensagens',
  sequence_slug: 'a sequência de follow-up',
  user_id: 'a pessoa',
  label_id: 'a etiqueta',
  stage_id: 'a etapa',
  title: 'o título da tarefa',
  group_jid: 'o destino do aviso',
  quick_reply_id: 'a resposta rápida',
  user_ids: 'quem recebe a notificação',
};

function paramName(type: string, key: string): string {
  if (key === 'user_id' && type === 'assign_broker') return 'o corretor';
  return PARAM_NAMES[key] ?? key;
}

/** O que falta preencher no bloco, em português, ou null se está pronto. */
export function leadActionProblem(config: FlowNodeConfig | null | undefined): string | null {
  const action = leadActionOf(config);
  if (!isLeadActionType(action.type)) return null;
  const missing = missingActionParams(action);
  if (missing.length === 0) return null;
  const names = missing.map(key => paramName(action.type, key));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `Falta preencher ${list}.`;
}
