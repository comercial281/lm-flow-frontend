// "Só continuar se" (filter_label) com critério vira "Condição" (condition) ao
// salvar a janela: o que passava segue pelo Sim, o Não fica vazio (encerra o
// fluxo, como o filtro fazia). O filtro legado (só `labels`, sem `criterion`)
// não converte: o motor lê coisas diferentes nele.

import type { FlowAutomationNode } from '@/types/flowAutomations';

export function canBecomeCondition(node: FlowAutomationNode): boolean {
  return node.kind === 'filter_label' && typeof node.config?.criterion === 'string' && node.config.criterion !== '';
}

export function toCondition(node: FlowAutomationNode): FlowAutomationNode {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { labels: _labels, mode: _mode, ...config } = node.config ?? {};
  return {
    ...node,
    kind: 'condition',
    config,
    next_yes_node_id: node.next_node_id ?? null,
    next_node_id: null,
    next_no_node_id: null,
  };
}
