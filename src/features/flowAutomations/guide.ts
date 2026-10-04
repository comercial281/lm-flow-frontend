// CONSTRUÇÃO GUIADA (Automações · sprint 4, spec 04/10/2026, parte B).
//
// O fluxo criado de um modelo traz, em cada bloco que a pessoa precisa olhar,
// um passo do guia (`node.guide`: "Passo 2 de 5 — Escreva a mensagem de
// abertura", com uma dica e os campos obrigatórios). O canvas mostra uma faixa
// com o passo atual, destaca o bloco dele e lista todos num checklist.
//
// O passo fica FEITO no servidor quando a pessoa clica em Salvar no painel do
// bloco (o `save_flow` leva `guide_done: true`) com os campos obrigatórios
// preenchidos. A tela só lê `guide.done` e manda o `guide_done`.
//
// MODO GUIADO (o corretor no funil de conversa, `permissions.guided`): só muda
// texto, mídia e tempo dos blocos e tira bloco de mensagem. O servidor garante
// (`FlowAutomations::GuidedSave`); a tela esconde o que ele recusaria.

import type { FlowAutomation, FlowAutomationKind, FlowAutomationNode, FlowNodeGuide } from '@/types/flowAutomations';

export interface GuideStep {
  nodeId: string;
  step: number;
  total: number;
  title: string;
  hint: string;
  required: string[];
  done: boolean;
}

/** Os passos do guia, na ordem (vazio = fluxo sem guia). */
export function guideSteps(nodes: Array<Pick<FlowAutomationNode, 'id' | 'guide'>>): GuideStep[] {
  return nodes
    .filter((n): n is Pick<FlowAutomationNode, 'id'> & { guide: FlowNodeGuide } => !!n.guide && typeof n.guide === 'object')
    .map(n => ({
      nodeId: n.id,
      step: Number(n.guide.step) || 0,
      total: Number(n.guide.total) || 0,
      title: String(n.guide.title ?? ''),
      hint: String(n.guide.hint ?? ''),
      required: Array.isArray(n.guide.required) ? n.guide.required.map(String) : [],
      done: n.guide.done === true,
    }))
    .sort((a, b) => a.step - b.step);
}

/** O passo atual: o primeiro que falta. Null quando tudo está feito (ou não há guia). */
export function currentStep(steps: GuideStep[]): GuideStep | null {
  return steps.find(s => !s.done) ?? null;
}

const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

/** "Passo 2 de 5" (o total é o número de passos que existem hoje). */
export function stepLabel(step: Pick<GuideStep, 'step' | 'total'>): string {
  return `Passo ${step.step} de ${step.total}`;
}

/** A frase da faixa: "clique no bloco destacado e escreva a mensagem de abertura". */
export function guideInstruction(step: Pick<GuideStep, 'title'>): string {
  const title = step.title.trim().replace(/\.$/, '');
  return title ? `clique no bloco destacado e ${lowerFirst(title)}.` : 'clique no bloco destacado.';
}

/** O fim do guia. O funil de conversa liga sozinho no servidor quando o último passo fica pronto. */
export function guideFinishedText(kind: FlowAutomationKind): string {
  if (kind === 'conversation') return 'Pronto! Seu funil já pode ser disparado nas conversas.';
  return 'Pronto! Você passou por todos os passos. Agora é só ligar o fluxo.';
}

/** "Falta terminar o guia: Passo 2 de 3 — Escolha a foto do imóvel." (ligar e disparar). */
export function guidePendingText(steps: GuideStep[], prefix = 'Falta terminar o guia antes de ligar'): string | null {
  const step = currentStep(steps);
  return step ? `${prefix}: ${stepLabel(step)} — ${step.title}.` : null;
}

/** Leitura de campo com ponto (`params.group_jid`), igual ao servidor (`Guide.filled?`). */
export function fieldFilled(config: Record<string, unknown> | null | undefined, path: string): boolean {
  const value = path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' && !Array.isArray(acc) ? (acc as Record<string, unknown>)[key] : undefined),
    config ?? {},
  );
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

const REQUIRED_MESSAGES: Record<string, string> = {
  text: 'Escreva a mensagem.',
  media_url: 'Escolha o arquivo pra mandar.',
  'params.group_jid': 'Escolha o grupo.',
};

/** O que falta preencher pro passo do guia contar, ou null. */
export function guideRequiredProblem(guide: Pick<FlowNodeGuide, 'required'> | null | undefined, config: Record<string, unknown>): string | null {
  for (const field of guide?.required ?? []) {
    if (!fieldFilled(config, field)) return REQUIRED_MESSAGES[field] ?? 'Preencha este bloco antes de salvar.';
  }
  return null;
}

// ── Modo guiado ────────────────────────────────────────────────────────────

/** Bloco de mensagem (o único que o corretor pode tirar). Mesma régua do servidor. */
export function isMessageNode(node: Pick<FlowAutomationNode, 'kind' | 'config'>): boolean {
  if (node.kind === 'send_whatsapp') return true;
  return node.kind === 'lead_action' && String(node.config?.action_type ?? '').startsWith('send_');
}

/**
 * Tira um bloco de mensagem RELIGANDO as pontas (modo guiado): quem apontava pra
 * ele passa a apontar pro seguinte, e se ele era o primeiro, o seguinte vira o
 * primeiro. O servidor aceita o ponteiro já religado (ou o antigo).
 */
export function removeAndRewire(
  nodes: FlowAutomationNode[],
  initialNodeId: string | null,
  id: string,
): { nodes: FlowAutomationNode[]; initialNodeId: string | null } {
  const removed = nodes.find(n => n.id === id);
  if (!removed) return { nodes, initialNodeId };
  const next = removed.next_node_id ?? null;
  const swap = (pointer: string | null) => (pointer === id ? next : pointer);
  return {
    nodes: nodes
      .filter(n => n.id !== id)
      .map(n => ({
        ...n,
        next_node_id: swap(n.next_node_id),
        next_yes_node_id: swap(n.next_yes_node_id),
        next_no_node_id: swap(n.next_no_node_id),
      })),
    initialNodeId: swap(initialNodeId),
  };
}

/** Quantas mensagens o fluxo tem (o funil precisa de pelo menos uma). */
export function messageCount(nodes: Array<Pick<FlowAutomationNode, 'kind' | 'config'>>): number {
  return nodes.filter(isMessageNode).length;
}

/** O fluxo veio com permissões do servidor e a pessoa não pode salvar (funil da equipe, pro corretor). */
export function isReadOnly(flow: Pick<FlowAutomation, 'permissions'> | null | undefined): boolean {
  return flow?.permissions?.can_edit === false;
}

/** Modo guiado: o corretor no funil de conversa. */
export function isGuided(flow: Pick<FlowAutomation, 'permissions'> | null | undefined): boolean {
  return flow?.permissions?.guided === true && flow?.permissions?.can_edit !== false;
}

/** O erro do servidor em português (`{ errors: [...] }`), ou o texto de reserva. */
export function serverMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { errors?: unknown; error?: unknown; message?: unknown } } })?.response?.data;
  if (Array.isArray(data?.errors) && typeof data.errors[0] === 'string' && data.errors[0]) return data.errors[0];
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (typeof data?.message === 'string' && data.message) return data.message;
  return fallback;
}
