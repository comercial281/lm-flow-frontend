// BLOCO "NOTIFICAÇÃO" (PR 9 do redesenho, 16/10/2026).
//
// Os cinco avisos (grupo, pessoa, corretor, gestor, push) viram UM bloco. A
// janela pergunta "Avisar quem" e "Por onde"; o servidor segue recebendo um dos
// cinco `action_type`, então aqui só traduzimos a escolha de tela <-> tipo.

import type { FlowNodeConfig } from '@/types/flowAutomations';
import { leadActionConfig, leadActionOf } from './leadAction';

export type NotifyWho = 'grupo' | 'pessoa' | 'corretor' | 'gestor';
export type NotifyVia = 'whatsapp' | 'app';
export interface NotifyChoice { quem: NotifyWho; onde: NotifyVia }

const TYPE_TO_CHOICE: Record<string, NotifyChoice> = {
  notify_group: { quem: 'grupo', onde: 'whatsapp' },
  notify_user: { quem: 'pessoa', onde: 'whatsapp' },
  notify_push: { quem: 'pessoa', onde: 'app' },
  notify_broker: { quem: 'corretor', onde: 'whatsapp' },
  notify_gestor: { quem: 'gestor', onde: 'whatsapp' },
};

export function isNotifyAction(type: unknown): boolean {
  return typeof type === 'string' && type in TYPE_TO_CHOICE;
}

export function notifyChoiceOf(actionType: string): NotifyChoice {
  return TYPE_TO_CHOICE[actionType] ?? TYPE_TO_CHOICE.notify_group;
}

/** A via que o destino não tem cai na via dele (só a pessoa tem as duas). */
export function notifyActionFor(choice: NotifyChoice): string {
  if (choice.quem === 'grupo') return 'notify_group';
  if (choice.quem === 'corretor') return 'notify_broker';
  if (choice.quem === 'gestor') return 'notify_gestor';
  return choice.onde === 'app' ? 'notify_push' : 'notify_user';
}

export function viasFor(quem: NotifyWho): NotifyVia[] {
  return quem === 'pessoa' ? ['whatsapp', 'app'] : ['whatsapp'];
}

/**
 * Troca a escolha mantendo a mensagem. Pessoa WhatsApp <-> app leva o destinatário
 * junto; o resto zera ('' ou []), nunca apaga chave (convenção do guided-merge).
 */
export function withNotifyChoice(config: FlowNodeConfig, choice: NotifyChoice): FlowNodeConfig {
  const atual = leadActionOf(config);
  const params = atual.params as Record<string, unknown>;
  const type = notifyActionFor(choice);
  const message = String(params.message ?? '');
  const ids = Array.isArray(params.user_ids) ? (params.user_ids as unknown[]).map(String) : [];
  const userId = String(params.user_id ?? '') || ids[0] || '';
  let next: Record<string, unknown>;
  switch (type) {
    case 'notify_group': next = { group_jid: '', message }; break;
    case 'notify_user': next = { user_id: userId, message }; break;
    case 'notify_push': next = { user_ids: userId ? [userId] : [], title: '', message }; break;
    default: next = { message };
  }
  if (type === 'notify_push' && atual.type === 'notify_push') {
    next = { ...next, user_ids: ids, title: String(params.title ?? '') };
  }
  return leadActionConfig({ type, params: next as Record<string, string | number> });
}
