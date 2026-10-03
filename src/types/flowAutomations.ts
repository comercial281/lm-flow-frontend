// Types do FlowBuilder — motor de automação visual, mirror do editor de
// fluxos do LM Hub. Backend: app/controllers/api/v1/flow_automations_controller.rb

export type FlowNodeKind =
  | 'send_whatsapp' | 'send_email' | 'notify_group' | 'send_capi' | 'notify_bell'
  | 'sequence' | 'funnel' | 'call_flow'
  | 'add_label' | 'remove_label' | 'create_pipeline_item' | 'move_stage' | 'move_pipeline'
  | 'assign_owner' | 'assign_round_robin' | 'set_next_action' | 'log_event'
  | 'wait' | 'filter_label' | 'wait_for_reply' | 'condition'
  | 'webhook' | 'http_call';

// Gatilho do fluxo (sprint 1 das Automações, 02/10/2026): o MESMO evento e o
// MESMO formato de condição das regras de Automações (LeadAutomationRule::TRIGGERS),
// tirando os que não disparam. `flow_called` é interno (bloco Conexão de fluxo).
export type FlowTriggerEvent =
  | 'lead.created' | 'lead.campaign_received'
  | 'lead.roleta_accepted' | 'lead.message_received'
  | 'lead.stage_changed' | 'lead.tag_added'
  | 'lead.visit_scheduled' | 'lead.visit_completed'
  | 'lead.visit_reminder_24h' | 'lead.visit_reminder_1h' | 'lead.visit_reminder_15min'
  | 'lead.interest_created'
  | 'flow_called';

/** Mesmo formato das condições das regras: { field, operator, value }. */
export interface FlowTriggerCondition {
  field: string;
  operator: string;
  value: string | string[];
}

export interface FlowNodeConfig {
  [key: string]: unknown;
}

export interface FlowAutomationStep {
  id: string;
  position: number;
  channel: 'whatsapp' | 'email' | 'internal';
  content: string | null;
  subject: string | null;
  media_url: string | null;
  wait_minutes: number;
  tag_on_send_id: string | null;
  active: boolean;
}

export interface FlowAutomationNode {
  id: string;
  kind: FlowNodeKind;
  label: string | null;
  config: FlowNodeConfig;
  next_node_id: string | null;
  next_yes_node_id: string | null;
  next_no_node_id: string | null;
  pos_x: number | null;
  pos_y: number | null;
  steps: FlowAutomationStep[];
}

// Contrato (spec 02/10): o backend devolve SEMPRE `{ event, conditions }`. O
// formato antigo (`contact_created`, `stage_id` solto…) só é lido por
// normalizeTrigger, por garantia.
export interface FlowAutomationTrigger {
  event: FlowTriggerEvent | string;
  conditions?: FlowTriggerCondition[];
  callers?: string[] | null;
  [key: string]: unknown;
}

export interface FlowAutomation {
  id: string;
  name: string;
  folder_id: string | null;
  trigger: FlowAutomationTrigger;
  is_enabled: boolean;
  initial_node_id: string | null;
  version: number;
  reentry_window_hours: number;
  max_depth: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  nodes?: FlowAutomationNode[];
}

export interface FlowAutomationFolder {
  id: string;
  name: string;
  color: string;
  position: number;
  automations_count: number;
  enabled_count: number;
}

export interface SaveFlowPayload {
  nodes: Array<Omit<FlowAutomationNode, 'id'> & { id?: string }>;
  initial_node_id: string | null;
}

export interface TestRunResult {
  instance_id: string;
  state: string;
  stop_reason: string | null;
  steps: Array<{ action: string; node_id: string | null; detail: string | null; error: string | null; at: string }>;
}

// Mirror de `PASSOS`/`DEF_POR_TIPO` de data/fluxos.ts do Hub — catálogo de
// blocos pra paleta do canvas. Cor/ícone ficam em flowAutomationGraph.ts.
export const FLOW_NODE_GROUPS = ['message', 'notify', 'contact', 'control'] as const;
export type FlowNodeGroup = (typeof FLOW_NODE_GROUPS)[number];

export interface FlowNodeDef {
  kind: FlowNodeKind;
  label: string;
  group: FlowNodeGroup;
  canFail: boolean;
  defaultConfig: FlowNodeConfig;
}

export const FLOW_NODE_DEFS: FlowNodeDef[] = [
  { kind: 'send_whatsapp', label: 'Mandar WhatsApp', group: 'message', canFail: true, defaultConfig: { text: '' } },
  { kind: 'send_email', label: 'Mandar e-mail', group: 'message', canFail: true, defaultConfig: { subject: '', text: '' } },
  { kind: 'notify_group', label: 'Avisar no WhatsApp (grupo ou número)', group: 'notify', canFail: true, defaultConfig: { text: '', targets: [] } },
  { kind: 'send_capi', label: 'Enviar evento pra Meta (CAPI)', group: 'notify', canFail: true, defaultConfig: { event_name: 'Lead' } },
  { kind: 'notify_bell', label: 'Avisar no sino', group: 'notify', canFail: false, defaultConfig: { user_id: '' } },
  { kind: 'sequence', label: 'Sequência de follow-up', group: 'message', canFail: false, defaultConfig: {} },
  { kind: 'funnel', label: 'Disparar funil de mensagens', group: 'message', canFail: true, defaultConfig: { funnel_id: '' } },
  { kind: 'call_flow', label: 'Conexão de fluxo', group: 'control', canFail: false, defaultConfig: { flow_automation_id: '' } },
  { kind: 'add_label', label: 'Aplicar etiqueta', group: 'contact', canFail: false, defaultConfig: { labels: [] } },
  { kind: 'remove_label', label: 'Tirar etiqueta', group: 'contact', canFail: false, defaultConfig: { labels: [] } },
  { kind: 'create_pipeline_item', label: 'Criar card no funil', group: 'contact', canFail: false, defaultConfig: { pipeline_id: '', stage_id: '' } },
  { kind: 'move_stage', label: 'Mover de etapa', group: 'contact', canFail: false, defaultConfig: { stage_id: '' } },
  { kind: 'move_pipeline', label: 'Mover de funil', group: 'contact', canFail: false, defaultConfig: { pipeline_id: '' } },
  { kind: 'assign_owner', label: 'Definir responsável', group: 'contact', canFail: false, defaultConfig: { user_id: '' } },
  { kind: 'assign_round_robin', label: 'Distribuir em rodízio', group: 'contact', canFail: false, defaultConfig: { user_ids: [] } },
  { kind: 'set_next_action', label: 'Marcar próxima ação', group: 'contact', canFail: false, defaultConfig: { text: '', in_hours: 24 } },
  { kind: 'log_event', label: 'Escrever na linha do tempo', group: 'contact', canFail: false, defaultConfig: { detail: '' } },
  { kind: 'wait', label: 'Esperar', group: 'control', canFail: false, defaultConfig: { mode: 'interval', minutes: 1440 } },
  { kind: 'filter_label', label: 'Só continuar se', group: 'control', canFail: false, defaultConfig: { criterion: 'has_label', label: '', labels: [], mode: 'all' } },
  { kind: 'wait_for_reply', label: 'Aguardar resposta', group: 'control', canFail: false, defaultConfig: { minutes: 1440, indefinite: false } },
  { kind: 'condition', label: 'Se / senão', group: 'control', canFail: false, defaultConfig: { criterion: 'replied', window_hours: 24 } },
  { kind: 'webhook', label: 'Avisar um sistema de fora', group: 'notify', canFail: true, defaultConfig: { event_name: '' } },
  { kind: 'http_call', label: 'Chamar uma API', group: 'notify', canFail: true, defaultConfig: { method: 'POST', url: '', headers: '', body: '' } },
];

export const FLOW_NODE_DEF_BY_KIND: Record<FlowNodeKind, FlowNodeDef> = FLOW_NODE_DEFS.reduce(
  (acc, def) => ({ ...acc, [def.kind]: def }),
  {} as Record<FlowNodeKind, FlowNodeDef>
);

// Os blocos que o motor garante nesta versão (spec 02/10, seção 5), na ordem da
// paleta. Os outros saem da paleta até a sprint 2; fluxo antigo que já tem um
// deles abre e mostra o bloco com o aviso de que ele volta na próxima versão.
export const FLOW_VISIBLE_NODE_KINDS: FlowNodeKind[] = [
  'send_whatsapp',
  'wait', 'wait_for_reply', 'condition', 'filter_label',
  'add_label', 'remove_label', 'move_stage',
];
