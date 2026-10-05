// PALETA DO CONSTRUTOR (sprint 2, spec 03/10/2026, seção 2).
//
// Os blocos da sprint 1 (Mandar WhatsApp, Esperar, Aguardar resposta, Se/senão,
// Só continuar se, Aplicar/Tirar etiqueta, Mover de etapa) + cada ação das
// Automações como bloco `lead_action` (leadAction.ts). Ação que já tem bloco da
// sprint 1 não aparece duas vezes: fica o bloco da sprint 1.
//
// Os blocos antigos do Hub (e-mail, CAPI, sino, webhook, API…) continuam fora.
// Fluxo que já tem um deles abre e mostra o bloco com HIDDEN_BLOCK_NOTICE.

import {
  FLOW_NODE_DEF_BY_KIND,
  FLOW_VISIBLE_NODE_KINDS,
  type FlowAutomationNode,
  type FlowNodeConfig,
  type FlowNodeGroup,
  type FlowNodeKind,
} from '@/types/flowAutomations';
import {
  PALETTE_LEAD_ACTIONS,
  isLeadActionType,
  leadActionGroup,
  leadActionLabel,
  newLeadActionConfig,
} from './leadAction';

export const HIDDEN_BLOCK_NOTICE = 'Este bloco volta na próxima versão';

export const PALETTE_GROUP_LABELS: Record<FlowNodeGroup, string> = {
  message: 'Mensagem pro lead',
  contact: 'Lead',
  notify: 'Avisos',
  control: 'Controle',
};

const GROUP_ORDER: FlowNodeGroup[] = ['message', 'contact', 'notify', 'control'];

// Os blocos da sprint 1 de cada grupo vêm antes das ações (ordem da spec).
const NATIVE_BY_GROUP: Record<FlowNodeGroup, FlowNodeKind[]> = {
  message: ['send_whatsapp'],
  contact: ['add_label', 'remove_label', 'move_stage', 'followup_recovered', 'hand_to_ai', 'disable_ai'],
  notify: [],
  control: ['wait', 'wait_for_reply', 'condition', 'filter_label'],
};

/** Um botão da paleta: o bloco que ele cria, já com a config inicial. */
export interface PaletteItem {
  key: string;
  kind: FlowNodeKind;
  label: string;
  group: FlowNodeGroup;
  config: FlowNodeConfig;
}

function nativeItem(kind: FlowNodeKind): PaletteItem {
  const def = FLOW_NODE_DEF_BY_KIND[kind];
  return { key: kind, kind, label: def.label, group: def.group, config: { ...def.defaultConfig } };
}

function actionItem(type: string): PaletteItem {
  return {
    key: `lead_action:${type}`,
    kind: 'lead_action',
    label: leadActionLabel(type),
    group: leadActionGroup(type),
    config: newLeadActionConfig(type),
  };
}

/** Todos os botões da paleta, na ordem da tabela da spec. */
export function paletteItems(): PaletteItem[] {
  return GROUP_ORDER.flatMap(group => [
    ...NATIVE_BY_GROUP[group].map(nativeItem),
    ...PALETTE_LEAD_ACTIONS.filter(type => leadActionGroup(type) === group).map(actionItem),
  ]);
}

export function isVisibleKind(kind: string): boolean {
  return (FLOW_VISIBLE_NODE_KINDS as string[]).includes(kind);
}

/** O bloco funciona nesta versão? `lead_action` só com uma ação que existe. */
export function isVisibleNode(node: Pick<FlowAutomationNode, 'kind' | 'config'>): boolean {
  if (!isVisibleKind(node.kind)) return false;
  if (node.kind === 'lead_action') return isLeadActionType(node.config?.action_type);
  return true;
}

/** O nome do bloco (sem o apelido): o da ação, no `lead_action`. */
export function blockLabel(node: Pick<FlowAutomationNode, 'kind' | 'config'>): string {
  if (node.kind === 'lead_action' && isLeadActionType(node.config?.action_type)) {
    return leadActionLabel(String(node.config.action_type));
  }
  return FLOW_NODE_DEF_BY_KIND[node.kind]?.label ?? 'Bloco';
}

/** O grupo do bloco, que dá a cor do cartão. */
export function blockGroup(node: Pick<FlowAutomationNode, 'kind' | 'config'>): FlowNodeGroup {
  if (node.kind === 'lead_action' && isLeadActionType(node.config?.action_type)) {
    return leadActionGroup(String(node.config.action_type));
  }
  return FLOW_NODE_DEF_BY_KIND[node.kind]?.group ?? 'control';
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Os grupos da paleta, na ordem da spec, filtrados pela busca (sem ligar pra acento). */
export function paletteGroups(query = ''): Array<{ group: FlowNodeGroup; label: string; items: PaletteItem[] }> {
  const q = semAcento(query.trim());
  const visible = paletteItems().filter(item => !q || semAcento(item.label).includes(q));
  return GROUP_ORDER
    .map(group => ({ group, label: PALETTE_GROUP_LABELS[group], items: visible.filter(i => i.group === group) }))
    .filter(g => g.items.length > 0);
}
