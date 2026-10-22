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

function conflictOf(raw: unknown, fallback: NumberConflictMode): NumberConflictMode {
  return CONFLICTS.includes(raw as NumberConflictMode) ? (raw as NumberConflictMode) : fallback;
}

export function flowNumberOf(
  flow: FlowAutomation,
  nodes: FlowAutomationNode[],
): { setting: FlowNumberSetting; saved: boolean; divergent: boolean } {
  // null/undefined = a regra nunca foi salva (fluxo legado). '' é salvo: "número da conversa do lead".
  if (flow.send_from !== null && flow.send_from !== undefined) {
    const v = sendFromOf({ send_from: flow.send_from, send_from_inbox_id: flow.send_from_inbox_id });
    return {
      setting: { mode: v.send_from, inboxId: v.send_from_inbox_id, onConflict: conflictOf(flow.number_conflict, 'pause') },
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

// ── Textos do número do fluxo (Entrega 4) ───────────────────────────────────

/** O que a tela precisa pra dizer por onde o fluxo fala: o modo e o final do número escolhido. */
export interface FlowNumberView {
  mode: SendFromMode;
  /** Os 2 últimos dígitos do número específico (null fora desse modo ou sem a lista). */
  final: string | null;
}

export const FLOW_NUMBER_GROUP = 'Por qual número este fluxo fala com o lead';
export const FLOW_NUMBER_OPTIONS: { value: SendFromMode; label: string }[] = [
  { value: '', label: 'Pelo número da conversa do lead' },
  { value: 'owner', label: 'Pelo número do responsável pelo lead' },
  { value: 'number', label: 'Por um número específico' },
];
export const FLOW_CONFLICT_GROUP = 'Se o lead já conversa com a equipe em outro número';
export const FLOW_CONFLICT_OPTIONS: { value: NumberConflictMode; label: string }[] = [
  { value: 'pause', label: 'Pausar e esperar alguém escolher' },
  { value: 'follow_conversation', label: 'Seguir pela conversa dele' },
  { value: 'force_flow_number', label: 'Mandar pelo número do fluxo mesmo assim' },
];
export const FLOW_NUMBER_DIVERGENT = 'Este fluxo fala por números diferentes. Escolha um nas Configurações.';

/** O grupo do conflito só existe quando o fluxo não fala pela conversa do lead. */
export function asksConflict(mode: SendFromMode): boolean {
  return mode === 'owner' || mode === 'number';
}

/** A linha do cartão do Início. */
export function flowNumberStartLine(v: FlowNumberView): string {
  if (v.mode === 'owner') return 'Fala pelo responsável pelo lead';
  if (v.mode === 'number') return v.final ? `Fala pelo final ${v.final}` : 'Fala por um número específico';
  return 'Fala pelo número da conversa';
}

/** A linha da janela da Mensagem, no lugar do "Enviar pelo número". */
export function flowNumberMessageLine(v: FlowNumberView): string {
  if (v.mode === 'owner') return 'Sai pelo número do responsável pelo lead. Trocar nas Configurações.';
  if (v.mode === 'number') {
    return v.final
      ? `Sai pelo número do fluxo (final ${v.final}). Trocar nas Configurações.`
      : 'Sai pelo número do fluxo. Trocar nas Configurações.';
  }
  return 'Sai pelo número da conversa do lead. Trocar nas Configurações.';
}

/** O corpo do "Passar para a IA" quando o fluxo tem número; null = o texto de sempre. */
export function flowNumberAiLine(v: FlowNumberView): string | null {
  if (v.mode === '') return null;
  return v.mode === 'number' && v.final
    ? `Quem atende: a IA do número do fluxo (final ${v.final}).`
    : 'Quem atende: a IA do número do fluxo.';
}
