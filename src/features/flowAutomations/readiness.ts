// O BLOCO ESTÁ PRONTO? (sprint 2, spec 03/10/2026, seção 4)
//
// O modelo cria o fluxo desligado, com funil, etapa, etiqueta e grupo em branco
// quando dependem do cliente. Esta é a régua única do que falta: a janela do
// bloco não salva com falta, o cartão no canvas mostra o que falta e a chave
// recusa ligar enquanto faltar.

import type { FlowAutomationNode } from '@/types/flowAutomations';
import { sendFromOf, sendFromProblem } from '@/features/numbers/sendFrom';
import { conditionProblem } from './conditions';
import { leadActionProblem } from './leadAction';
import { blockLabel, isVisibleNode } from './palette';
import { triggerProblem, type FlowTrigger } from './trigger';

type BlockLike = Pick<FlowAutomationNode, 'kind' | 'config'>;

/** O que falta no bloco, em português, ou null. Bloco escondido não é conferido. */
export function nodeProblem(node: BlockLike): string | null {
  if (!isVisibleNode(node)) return null;
  const config = node.config ?? {};
  switch (node.kind) {
    case 'send_whatsapp':
      return !String(config.text ?? '').trim() ? 'Escreva a mensagem.' : sendFromProblem(sendFromOf(config));
    case 'condition':
    case 'filter_label':
      return conditionProblem(config);
    case 'move_stage':
      return config.stage_id ? null : 'Escolha a etapa.';
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
export function enableProblem(trigger: FlowTrigger, nodes: Array<BlockLike & { label?: string | null }>): string | null {
  const issue = triggerProblem(trigger);
  if (issue) return `Antes de ligar: ${issue.charAt(0).toLowerCase()}${issue.slice(1)}`;
  for (const node of nodes) {
    const problem = nodeProblem(node);
    if (problem) return `Antes de ligar, complete o bloco "${node.label || blockLabel(node)}": ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`;
  }
  return null;
}
