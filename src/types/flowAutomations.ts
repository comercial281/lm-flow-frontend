// Types do FlowBuilder — motor de automação visual, mirror do editor de
// fluxos do LM Hub. Backend: app/controllers/api/v1/flow_automations_controller.rb

export type FlowNodeKind =
  | 'send_whatsapp' | 'send_email' | 'notify_group' | 'send_capi' | 'notify_bell'
  | 'sequence' | 'funnel' | 'call_flow'
  | 'add_label' | 'remove_label' | 'create_pipeline_item' | 'move_stage' | 'move_pipeline'
  | 'assign_owner' | 'assign_round_robin' | 'set_next_action' | 'log_event'
  | 'wait' | 'filter_label' | 'wait_for_reply' | 'condition'
  | 'webhook' | 'http_call'
  // Sprint 2 (03/10/2026): uma ação das Automações como bloco. Config
  // `{ action_type, params }`, executada pelo MESMO LeadAutomation::Executor.
  | 'lead_action'
  // Sprint 3 (03/10/2026): o que o follow-up antigo fazia quando o lead
  // respondia, como bloco. Sem config.
  | 'followup_recovered'
  // Book pelo site (05/10/2026): passam a conversa pra IA Vendedora ou param a IA
  // pra este lead. Sem config; o servidor trata como `followup_recovered`.
  | 'hand_to_ai' | 'disable_ai';

/**
 * Sprint 3: o fluxo é uma automação (aba Automações) ou um follow-up (aba Follow-up).
 * Sprint 4: `conversation` = funil de conversa do corretor (página Funis de mensagem),
 * disparado à mão no campo de mensagem.
 */
export type FlowAutomationKind = 'automation' | 'followup' | 'conversation';

// Gatilho do fluxo (sprint 1 das Automações, 02/10/2026): o MESMO evento e o
// MESMO formato de condição das regras de Automações (LeadAutomationRule::TRIGGERS),
// tirando os que não disparam. `flow_called` é interno (bloco Conexão de fluxo).
export type FlowTriggerEvent =
  | 'lead.created' | 'lead.campaign_received'
  | 'lead.roleta_accepted' | 'lead.message_received'
  | 'lead.stage_changed' | 'lead.tag_added'
  | 'lead.visit_scheduled' | 'lead.visit_completed'
  | 'lead.visit_reminder_24h' | 'lead.visit_reminder_1h' | 'lead.visit_reminder_15min'
  | 'lead.interest_created' | 'lead.book_requested'
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

/**
 * Passo da construção guiada (sprint 4): o fluxo criado de um modelo traz, em
 * cada bloco que a pessoa precisa olhar, "Passo 2 de 5 — Escreva a mensagem de
 * abertura" + uma dica. `required` são os campos do config que precisam estar
 * preenchidos (caminho com ponto: `params.group_jid`). `done` vem do servidor.
 */
export interface FlowNodeGuide {
  step: number;
  total: number;
  title: string;
  hint: string;
  required: string[];
  done: boolean;
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
  /** Sprint 4: o passo do guia deste bloco (null/ausente = bloco sem passo). Só leitura. */
  guide?: FlowNodeGuide | null;
  /**
   * Sprint 4, só na tela: a pessoa clicou em Salvar no painel deste bloco. Vai
   * no `save_flow` como `guide_done: true` e o servidor marca o passo como feito.
   */
  guide_done?: boolean;
}

/** Um passo do guia que falta (`guide_pending` do fluxo), em ordem. */
export interface FlowGuidePending {
  node_id: string;
  step: number;
  total: number;
  title: string;
}

/** O que QUEM PEDIU pode fazer com o fluxo (sprint 4; muda algo só no funil de conversa). */
export interface FlowPermissions {
  /** Abrir o canvas pra salvar. Falso = só ver (funil da equipe, pro corretor). */
  can_edit: boolean;
  /** Modo guiado: salva só conteúdo (texto, mídia, tempo) e tira mensagem. */
  guided: boolean;
  /** Mexer em "Da equipe" (só o gestor). */
  can_mark_team: boolean;
  /** Criar do zero (só o gestor, no funil de conversa). */
  can_create_blank: boolean;
}

// Contrato (spec 02/10): o backend devolve SEMPRE `{ event, conditions }`. O
// formato antigo (`contact_created`, `stage_id` solto…) só é lido por
// normalizeTrigger, por garantia. Sprint 3: `alternatives` são os outros
// gatilhos ("+ Ou quando…"), com OU entre o principal e cada um.
export interface FlowAutomationTrigger {
  event: FlowTriggerEvent | string;
  conditions?: FlowTriggerCondition[];
  alternatives?: Array<{ event: FlowTriggerEvent | string; conditions?: FlowTriggerCondition[] }>;
  callers?: string[] | null;
  [key: string]: unknown;
}

export interface FlowAutomation {
  id: string;
  name: string;
  /** Sprint 3: o servidor guarda em `state.kind`; ausente = automação. */
  kind?: FlowAutomationKind;
  folder_id: string | null;
  trigger: FlowAutomationTrigger;
  is_enabled: boolean;
  initial_node_id: string | null;
  version: number;
  /** "Pode rodar de novo pro mesmo lead": horas; 0 = sempre que o gatilho acontecer. */
  reentry_window_hours: number;
  /** "Só uma vez por lead" (sprint 2). O servidor guarda em `state`; aceita os dois. */
  once_per_lead?: boolean;
  /** "Só em horário comercial" (sprint 3): nenhuma mensagem do fluxo sai fora da janela. Também em `state`. */
  business_hours_only?: boolean;
  state?: { once_per_lead?: boolean; business_hours_only?: boolean; kind?: FlowAutomationKind; [key: string]: unknown } | null;
  max_depth: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  nodes?: FlowAutomationNode[];
  // ── Sprint 4: funil de conversa e construção guiada ──
  owner_user_id?: string | number | null;
  owner_name?: string | null;
  /** "Da equipe": todo mundo vê e dispara, só o gestor edita. */
  team?: boolean;
  converted_from_message_funnel_id?: string | number | null;
  /** Todos os passos do guia feitos (fluxo sem guia = true). */
  guide_done?: boolean;
  guide_pending?: FlowGuidePending[];
  permissions?: FlowPermissions;
  /** 05/10/2026: quantas mensagens o funil manda (vem na lista, que não traz os blocos). */
  message_count?: number;
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
  // Nome e grupo de cada ação vêm de features/flowAutomations/leadAction.ts.
  { kind: 'lead_action', label: 'Ação', group: 'contact', canFail: true, defaultConfig: { action_type: '', params: {} } },
  { kind: 'followup_recovered', label: 'Marcar como recuperado pelo follow-up', group: 'contact', canFail: false, defaultConfig: {} },
  { kind: 'hand_to_ai', label: 'Passar para a IA', group: 'contact', canFail: false, defaultConfig: {} },
  { kind: 'disable_ai', label: 'Desligar a IA', group: 'contact', canFail: false, defaultConfig: {} },
];

export const FLOW_NODE_DEF_BY_KIND: Record<FlowNodeKind, FlowNodeDef> = FLOW_NODE_DEFS.reduce(
  (acc, def) => ({ ...acc, [def.kind]: def }),
  {} as Record<FlowNodeKind, FlowNodeDef>
);

// Os blocos que o motor garante (spec 02/10, seção 5, e sprint 2 de 03/10). Os
// blocos antigos do Hub continuam fora; fluxo que já tem um deles abre e mostra
// o bloco com o aviso de que ele volta na próxima versão. A ordem da paleta
// mora em features/flowAutomations/palette.ts.
export const FLOW_VISIBLE_NODE_KINDS: FlowNodeKind[] = [
  'send_whatsapp',
  'wait', 'wait_for_reply', 'condition', 'filter_label',
  'add_label', 'remove_label', 'move_stage',
  'lead_action',
  'followup_recovered',
  'hand_to_ai', 'disable_ai',
];
