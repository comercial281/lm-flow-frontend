// NÚMERO DO FLUXO (Entrega 4) — o fluxo de equipe fala com o lead por UM número.
// Quem decide (pausar, seguir a conversa, forçar o número) é o servidor; aqui
// ficam o formato do valor, a leitura do que está salvo e o espelho nas Mensagens.
// Fluxo antigo, sem a regra salva, tem o número inferido das Mensagens.

import { sendFromOf, applySendFrom, type SendFromMode } from '@/features/numbers/sendFrom';
import type { FlowAutomation, FlowAutomationNode, NumberConflictMode } from '@/types/flowAutomations';

export interface FlowNumberSetting {
  mode: SendFromMode;
  inboxId: string;
  onConflict: NumberConflictMode;
}

const CONFLICTS: NumberConflictMode[] = ['pause', 'follow_conversation', 'force_flow_number'];

function conflictOf(raw: unknown): NumberConflictMode {
  return CONFLICTS.includes(raw as NumberConflictMode) ? (raw as NumberConflictMode) : 'follow_conversation';
}

export function flowNumberOf(
  flow: FlowAutomation,
  nodes: FlowAutomationNode[],
): { setting: FlowNumberSetting; saved: boolean; divergent: boolean } {
  // '' / null = a regra nunca foi salva neste fluxo.
  if (flow.send_from) {
    const v = sendFromOf({ send_from: flow.send_from, send_from_inbox_id: flow.send_from_inbox_id });
    return {
      setting: { mode: v.send_from, inboxId: v.send_from_inbox_id, onConflict: conflictOf(flow.number_conflict) },
      saved: true,
      divergent: false,
    };
  }
  const values = nodes
    .filter(n => n.kind === 'send_whatsapp')
    .map(n => sendFromOf(n.config as { send_from?: unknown; send_from_inbox_id?: unknown }));
  const first = values[0];
  if (!first) return { setting: { mode: '', inboxId: '', onConflict: 'follow_conversation' }, saved: false, divergent: false };
  const same = values.every(v => v.send_from === first.send_from && v.send_from_inbox_id === first.send_from_inbox_id);
  if (!same) return { setting: { mode: '', inboxId: '', onConflict: 'follow_conversation' }, saved: false, divergent: true };
  return {
    setting: { mode: first.send_from, inboxId: first.send_from_inbox_id, onConflict: 'follow_conversation' },
    saved: false,
    divergent: false,
  };
}

export function serializeFlowNumber(s: FlowNumberSetting): {
  send_from: SendFromMode;
  send_from_inbox_id: string;
  number_conflict: NumberConflictMode;
} {
  return { send_from: s.mode, send_from_inbox_id: s.inboxId, number_conflict: s.onConflict };
}

/** Espelha o número em cada Mensagem (send_whatsapp). Não toca ação de lead. */
export function withFlowSendFrom(nodes: FlowAutomationNode[], s: FlowNumberSetting): FlowAutomationNode[] {
  return nodes.map(n =>
    n.kind === 'send_whatsapp'
      ? { ...n, config: applySendFrom(n.config as Record<string, unknown>, { send_from: s.mode, send_from_inbox_id: s.inboxId }) as FlowAutomationNode['config'] }
      : n,
  );
}
