// PALETA ENXUTA (spec 02/10, seção 5): só os 8 blocos que o motor garante.
// Os outros 15 voltam na sprint 2, como as ações das Automações. Fluxo antigo
// que já tem um deles abre e mostra o bloco com HIDDEN_BLOCK_NOTICE, sem quebrar.

import {
  FLOW_NODE_DEFS,
  FLOW_VISIBLE_NODE_KINDS,
  type FlowNodeDef,
  type FlowNodeGroup,
} from '@/types/flowAutomations';

export const HIDDEN_BLOCK_NOTICE = 'Este bloco volta na próxima versão';

export const PALETTE_GROUP_LABELS: Record<FlowNodeGroup, string> = {
  message: 'Mensagem',
  control: 'Controle',
  contact: 'Lead',
  notify: 'Avisos',
};

const GROUP_ORDER: FlowNodeGroup[] = ['message', 'control', 'contact', 'notify'];

export function isVisibleKind(kind: string): boolean {
  return (FLOW_VISIBLE_NODE_KINDS as string[]).includes(kind);
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Os grupos da paleta, na ordem da spec, filtrados pela busca (sem ligar pra acento). */
export function paletteGroups(query = ''): Array<{ group: FlowNodeGroup; label: string; defs: FlowNodeDef[] }> {
  const q = semAcento(query.trim());
  const visible = FLOW_VISIBLE_NODE_KINDS
    .map(kind => FLOW_NODE_DEFS.find(d => d.kind === kind))
    .filter((d): d is FlowNodeDef => !!d)
    .filter(d => !q || semAcento(d.label).includes(q));
  return GROUP_ORDER
    .map(group => ({ group, label: PALETTE_GROUP_LABELS[group], defs: visible.filter(d => d.group === group) }))
    .filter(g => g.defs.length > 0);
}
