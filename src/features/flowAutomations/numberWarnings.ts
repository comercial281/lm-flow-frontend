// Avisos de número na hora de montar (Entrega 4). Não bloqueiam: o servidor é
// quem pausa o lead; aqui a pessoa descobre ANTES de ligar o fluxo.

import { triggerEvents, type FlowTrigger } from './trigger';
import type { FlowNumberSetting } from './flowNumber';
import type { FlowAutomationNode } from '@/types/flowAutomations';

// Sem lead.roleta_accepted: no aceite o lead só falou com a IA (caso Basel).
const CONFLICT_EVENTS = ['lead.visit_completed', 'lead.stage_changed'];

export const WARN_CONFLICT =
  'Esse lead normalmente já conversa com o corretor em outro número. Escolha “Seguir pela conversa dele” ou o número da conversa.';
export const WARN_NO_AI = 'Esse número não tem IA. Escolha o número da IA ou tire o bloco Passar para a IA.';
export const WARN_AI_ONLY_REPLIES = 'A IA só responde, não abre conversa. Ponha uma Mensagem antes do Passar para a IA.';

// Ações de lead que mandam WhatsApp: contam como "uma mensagem antes" do Passar para a IA.
export const MESSAGE_SENDING_ACTIONS = new Set([
  'send_message_funnel', 'send_quick_reply', 'send_whatsapp_message',
  'send_audio', 'send_image', 'send_video', 'send_document', 'send_sticker',
]);

function sendsMessage(n: FlowAutomationNode | undefined): boolean {
  if (!n) return false;
  if (n.kind === 'send_whatsapp') return true;
  return n.kind === 'lead_action' && MESSAGE_SENDING_ACTIONS.has(String((n.config as Record<string, unknown> | null)?.action_type));
}

function nextsOf(n: FlowAutomationNode): string[] {
  return [n.next_node_id, n.next_yes_node_id, n.next_no_node_id].filter((x): x is string => !!x);
}

export function numberWarnings(input: {
  trigger: FlowTrigger;
  nodes: FlowAutomationNode[];
  initialNodeId: string | null;
  setting: FlowNumberSetting | null;
  inboxesWithAi: Set<string>;
}): string[] {
  const { trigger, nodes, initialNodeId, setting, inboxesWithAi } = input;
  if (!setting) return [];
  const out: string[] = [];
  const asks = setting.mode === 'owner' || setting.mode === 'number';
  if (asks && triggerEvents(trigger).some(e => CONFLICT_EVENTS.includes(e))) out.push(WARN_CONFLICT);

  const hands = nodes.filter(n => n.kind === 'hand_to_ai');
  if (hands.length === 0) return out;
  if (setting.mode === 'number' && setting.inboxId && !inboxesWithAi.has(setting.inboxId)) out.push(WARN_NO_AI);

  if (initialNodeId) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    // Quem o Início alcança.
    const reach = new Set<string>();
    const stack = [initialNodeId];
    while (stack.length) {
      const id = stack.pop()!;
      if (reach.has(id)) continue;
      reach.add(id);
      const n = byId.get(id);
      if (n) stack.push(...nextsOf(n));
    }
    // Predecessores (só entre os alcançados).
    const preds = new Map<string, string[]>();
    for (const id of reach) {
      const n = byId.get(id);
      if (!n) continue;
      for (const to of nextsOf(n)) preds.set(to, [...(preds.get(to) ?? []), id]);
    }
    const hasMessageBefore = (target: string): boolean => {
      const seen = new Set<string>([target]);
      const st = [...(preds.get(target) ?? [])];
      while (st.length) {
        const id = st.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        if (sendsMessage(byId.get(id))) return true;
        st.push(...(preds.get(id) ?? []));
      }
      return false;
    };
    if (hands.some(h => reach.has(h.id) && !hasMessageBefore(h.id))) out.push(WARN_AI_ONLY_REPLIES);
  }
  return out;
}
