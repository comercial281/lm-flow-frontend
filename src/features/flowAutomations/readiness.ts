// O BLOCO ESTÁ PRONTO? (sprint 2, spec 03/10/2026, seção 4)
//
// O modelo cria o fluxo desligado, com funil, etapa, etiqueta e grupo em branco
// quando dependem do cliente. Esta é a régua única do que falta: a janela do
// bloco não salva com falta, o cartão no canvas mostra o que falta e a chave
// recusa ligar enquanto faltar.

import type { FlowAutomationKind, FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { sendFromOf, sendFromProblem } from '@/features/numbers/sendFrom';
import { usesBook } from './book';
import { hasStoredItems, messageItemsOf } from './messageItems';
import { conditionProblem } from './conditions';
import { leadActionProblem } from './leadAction';
import { moveStageModeOf, moveStageProblem } from './moveStage';
import { progressProblem } from './progress';
import { blockLabel, isVisibleNode } from './palette';
import { triggerProblem, type FlowTrigger } from './trigger';

type BlockLike = Pick<FlowAutomationNode, 'kind' | 'config'>;

const blank = (value: unknown) => String(value ?? '').trim() === '';
const MEDIA_KINDS = new Set(['image', 'video', 'audio', 'document', 'sticker']);

/**
 * O bloco Mensagem em sequência (PR 8, 16/10/2026). O item de book não é
 * conferido (o servidor acha o arquivo), mas conta como mensagem; os outros
 * itens são. A primeira falta que valer: mídia sem arquivo, texto vazio,
 * contato sem telefone, nenhuma mensagem.
 */
function sequenceProblem(config: FlowNodeConfig): string | null {
  const messages = messageItemsOf(config);
  const checked = messages.filter(item => item.kind !== 'property_book');
  if (checked.some(item => MEDIA_KINDS.has(item.kind) && blank(item.media_url))) return 'Escolha o arquivo pra mandar.';
  if (checked.some(item => item.kind === 'text' && blank(item.text_content))) return 'Escreva a mensagem.';
  if (checked.some(item => item.kind === 'contact' && blank(item.config?.contact_phone))) return 'Escreva o telefone do contato.';
  if (messages.length === 0) return 'Escreva a mensagem.';
  return sendFromProblem(sendFromOf(config)) ?? progressProblem(config);
}

/**
 * No follow-up, o "Mover pra coluna de resposta" com o nome em branco é
 * escolha válida (o modelo nasce assim): o motor não move e, quando o lead
 * responde, o card volta pra coluna de onde veio (Fase 2). O corretor nem
 * pode preencher (modo guiado), então não pode travar o Ligado.
 */
function blankReplyColumn(node: BlockLike): boolean {
  const config = node.config ?? {};
  return node.kind === 'move_stage' && moveStageModeOf(config) === 'name'
    && typeof config.stage_name === 'string' && config.stage_name.trim() === '';
}

/** O que falta no bloco, em português, ou null. Bloco escondido não é conferido. */
export function nodeProblem(node: BlockLike, kind: FlowAutomationKind = 'automation'): string | null {
  if (kind === 'followup' && blankReplyColumn(node)) return null;
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
 * O fluxo começa pelo gatilho dele? Só a automação. O funil de conversa é
 * disparado na conversa; o follow-up, pelas portas (o motor ignora gatilho
 * gravado num follow-up).
 */
export function hasOwnTrigger(kind: FlowAutomationKind): boolean {
  return kind !== 'conversation' && kind !== 'followup';
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
  // O follow-up não tem gatilho (Fase 2): começa pelas portas (coluna, janela, IA, automação).
  const issue = hasOwnTrigger(kind) ? triggerProblem(trigger) : null;
  if (issue) return `Antes de ligar: ${issue.charAt(0).toLowerCase()}${issue.slice(1)}`;
  for (const node of nodes) {
    const problem = nodeProblem(node, kind);
    if (problem) return `Antes de ligar, complete o bloco "${node.label || blockLabel(node)}": ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`;
  }
  return null;
}
