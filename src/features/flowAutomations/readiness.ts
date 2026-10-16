// O BLOCO ESTÁ PRONTO? (sprint 2, spec 03/10/2026, seção 4)
//
// O modelo cria o fluxo desligado, com funil, etapa, etiqueta e grupo em branco
// quando dependem do cliente. Esta é a régua única do que falta: a janela do
// bloco não salva com falta, o cartão no canvas mostra o que falta e a chave
// recusa ligar enquanto faltar.

import type { FlowAutomationKind, FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { sendFromOf, sendFromProblem } from '@/features/numbers/sendFrom';
import { usesBook } from './book';
import { hasBookItem, hasStoredItems, messageItemsOf } from './messageItems';
import { conditionProblem } from './conditions';
import { leadActionProblem } from './leadAction';
import { moveStageProblem } from './moveStage';
import { progressProblem } from './progress';
import { blockLabel, isVisibleNode } from './palette';
import { triggerProblem, type FlowTrigger } from './trigger';

type BlockLike = Pick<FlowAutomationNode, 'kind' | 'config'>;

const blank = (value: unknown) => String(value ?? '').trim() === '';
const MEDIA_KINDS = new Set(['image', 'video', 'audio', 'document', 'sticker']);

/**
 * O bloco Mensagem em sequência (PR 8, 16/10/2026). Com book, o servidor acha
 * o arquivo e nada mais é conferido. Sem book, a primeira falta que valer:
 * mídia sem arquivo, texto vazio, contato sem telefone, nenhuma mensagem.
 */
function sequenceProblem(config: FlowNodeConfig): string | null {
  const ending = () => sendFromProblem(sendFromOf(config)) ?? progressProblem(config);
  if (hasBookItem(config)) return ending();
  const messages = messageItemsOf(config);
  if (messages.some(item => MEDIA_KINDS.has(item.kind) && blank(item.media_url))) return 'Escolha o arquivo pra mandar.';
  if (messages.some(item => item.kind === 'text' && blank(item.text_content))) return 'Escreva a mensagem.';
  if (messages.some(item => item.kind === 'contact' && blank(item.config?.contact_phone))) return 'Escreva o telefone do contato.';
  if (messages.length === 0) return 'Escreva a mensagem.';
  return ending();
}

/** O que falta no bloco, em português, ou null. Bloco escondido não é conferido. */
export function nodeProblem(node: BlockLike): string | null {
  if (!isVisibleNode(node)) return null;
  const config = node.config ?? {};
  switch (node.kind) {
    case 'send_whatsapp': {
      if (hasStoredItems(config)) return sequenceProblem(config);
      // Formato antigo (sem `items`). Sprint 4 (funil de conversa): a mensagem
      // pode ser mídia (o texto vira legenda, opcional) ou cartão de contato.
      const mediaKind = String(config.media_kind ?? '').trim();
      const hasMedia = String(config.media_url ?? '').trim() !== '';
      const isContact = String(config.contact_phone ?? '').trim() !== '';
      if (usesBook(config)) return sendFromProblem(sendFromOf(config)) ?? progressProblem(config);
      if (mediaKind && !hasMedia) return 'Escolha o arquivo pra mandar.';
      if (!hasMedia && !isContact && !String(config.text ?? '').trim()) return 'Escreva a mensagem.';
      return sendFromProblem(sendFromOf(config)) ?? progressProblem(config);
    }
    case 'condition':
    case 'filter_label':
      return conditionProblem(config);
    case 'move_stage':
      return moveStageProblem(config);
    case 'add_label':
    case 'remove_label':
      return Array.isArray(config.labels) && config.labels.length > 0 ? null : 'Escolha a etiqueta.';
    case 'wait':
      return config.mode === 'date' && !config.target_at ? 'Escolha a data e a hora.' : null;
    case 'lead_action':
      return leadActionProblem(config);
    default:
      return null;
  }
}

/**
 * Por que o fluxo ainda não pode ser ligado, ou null. Confere o gatilho e cada
 * bloco; a frase diz qual bloco e o que falta nele.
 */
export function enableProblem(
  trigger: FlowTrigger,
  nodes: Array<BlockLike & { label?: string | null }>,
  kind: FlowAutomationKind = 'automation',
): string | null {
  // O funil de conversa (sprint 4) tem gatilho fixo: começa quando alguém dispara na conversa.
  const issue = kind === 'conversation' ? null : triggerProblem(trigger);
  if (issue) return `Antes de ligar: ${issue.charAt(0).toLowerCase()}${issue.slice(1)}`;
  for (const node of nodes) {
    const problem = nodeProblem(node);
    if (problem) return `Antes de ligar, complete o bloco "${node.label || blockLabel(node)}": ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`;
  }
  return null;
}
