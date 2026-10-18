import api from '@/services/core/api';

export interface LeadAutomationCondition {
  field: string;
  operator: string;
  value: string | string[];
}

export interface LeadAutomationAction {
  type: string;
  params?: Record<string, string | number>;
}

const BASE = '/lead_automation_rules';

export const leadAutomationService = {
  // Anúncios já recebidos (CTWA + formulário) pra montar rota de funil por anúncio.
  async getAdOrigins(): Promise<AdOrigin[]> {
    const res = await api.get(`${BASE}/ad_origins`);
    return (res.data as { data: AdOrigin[] }).data ?? [];
  },

  // Formulários (Meta Lead Ads) conhecidos, pra filtrar a automação por formulário.
  async getFormOrigins(): Promise<FormOrigin[]> {
    const res = await api.get(`${BASE}/form_origins`);
    return (res.data as { data: FormOrigin[] }).data ?? [];
  },

  // Grupos de WhatsApp (por nome) de uma instância, pro dropdown do "Notificar grupo".
  async getGroups(instance?: string, all?: boolean): Promise<WaGroup[]> {
    return (await leadAutomationService.getGroupsResult(instance, all)).groups;
  },

  // Igual ao getGroups, mas com o MOTIVO quando a lista vem vazia. Sem isso o
  // seletor de grupo só ficava sem opção nenhuma, sem dizer o que houve — e o
  // caminho mais comum (nome da instância errado ou fora do ar) fica invisível.
  async getGroupsResult(instance?: string, all?: boolean): Promise<WaGroupsResult> {
    const params: Record<string, string | boolean> = {};
    if (instance) params.instance = instance;
    if (all) params.all = true;
    const res = await api.get(`${BASE}/groups`, { params });
    const data = (res.data as { data?: WaGroupsResult }).data;
    return { groups: data?.groups ?? [], reason: data?.reason ?? null, instance: data?.instance ?? null };
  },

  // Instâncias Evolution disponíveis (super-admin only). Usadas no seletor "Instância de envio".
  async getEvolutionInstances(): Promise<EvolutionInstance[]> {
    const res = await api.get('/super/evolution_instances');
    return (res.data as { data: EvolutionInstance[] }).data ?? [];
  },
};

export interface WaGroup {
  id: string;   // JID …@g.us
  name: string;
}

// Lista de grupos + o motivo de ela estar vazia, quando estiver.
export interface WaGroupsResult {
  groups: WaGroup[];
  reason: string | null;
  instance: string | null;
}

// Instância Evolution listada pelo endpoint global (super-admin only).
export interface EvolutionInstance {
  name: string;
  status: string;   // "open" | "connecting" | "close"
  number: string;
  token: string;
}

// Anúncio de origem agregado (vindo do ad_referral das conversas/contatos).
export interface AdOrigin {
  ad_id: string | null;
  title: string | null;
  campaign_name: string | null;
  source: string;
  count: number;
}

// Formulário (Meta Lead Ads) conhecido — config salva ou já trouxe lead.
export interface FormOrigin {
  form_id: string;
  form_name: string | null;
  count: number;
}

// Triggers emitidos pelo backend Rails (LeadAutomationExecutorJob.perform_later).
// 'lead.no_reply_after' é emitido por Followup::NoReplyEnrollJob (roda a cada 1 min).
export const TRIGGER_LABELS: Record<string, string> = {
  'lead.created':              'Lead criado',
  'lead.stage_changed':        'Etapa alterada',
  'lead.visit_scheduled':      'Visita agendada',
  'lead.visit_rescheduled':    'Visita remarcada',
  'lead.visit_completed':      'Visita realizada',
  'lead.visit_reminder_24h':   'Lembrete 1 dia antes da visita',
  'lead.visit_reminder_1h':    'Lembrete 1 hora antes da visita',
  'lead.visit_reminder_15min': 'Lembrete 15 minutos antes da visita',
  'lead.interest_created':     'Interesse em imóvel',
  'lead.book_requested':       'Pediu o book no site',
  'lead.inactive_7d':          'Inativo há 7 dias',
  'lead.inactive_14d':         'Inativo há 14 dias',
  'lead.property_matched':     'Imóvel compatível encontrado',
  'lead.tag_added':            'Etiqueta adicionada',
  'lead.message_received':     'Mensagem recebida do lead',
  'lead.campaign_received':    'Lead de anúncio no WhatsApp',
  'lead.no_reply_after':       'Sem resposta após X minutos',
  'lead.roleta_accepted':      'Corretor aceitou o lead (roleta)',
};

// Actions processadas pelo LeadAutomation::Executor.
export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_whatsapp_message:   'Enviar mensagem no WhatsApp',
  send_audio:              'Enviar áudio',
  send_image:              'Enviar imagem',
  send_video:              'Enviar vídeo',
  send_document:           'Enviar documento',
  send_sticker:            'Enviar figurinha',
  send_message_funnel:     'Disparar funil de mensagens',
  start_followup_sequence: 'Iniciar sequência de follow-up (formato antigo)',
  start_followup_flow:     'Iniciar follow-up',
  assign_broker:           'Atribuir corretor',
  assign_via_roleta:       'Distribuir pela roleta',
  add_label:               'Adicionar etiqueta',
  remove_label:            'Remover etiqueta',
  move_pipeline_stage:     'Mover no funil',
  create_task:             'Criar tarefa',
  notify_group:            'Notificar grupo',
  notify_user:             'Avisar usuário no WhatsApp (lembrete)',
  notify_broker:           'Notificar corretor (WhatsApp pessoal)',
  notify_gestor:           'Notificar gestor (WhatsApp)',
  notify_push:             'Aviso no app (Modo Plantão)',
  send_quick_reply:        'Enviar resposta rápida',
  wait:                    'Aguardar um tempo',
};

// Ações que não aparecem mais na lista pra regra nova. "Aguardar (delay)"
// prometia uma espera que o servidor nunca fez (as ações seguintes saem na
// hora); quem precisa esperar usa o construtor de fluxos. Regra antiga que já
// tem a ação continua igual, com o aviso no cartão.
export const RETIRED_ACTION_TYPES = new Set(['wait']);

export const WAIT_ACTION_NOTICE = 'Esta etapa não espera: as ações seguintes saem na hora';

// Params obrigatórios por action.type — chaves exatas do backend (LeadAutomation::Executor).
// Um mapa só para as duas telas: a regra (validateRule) e o bloco de ação do
// construtor de fluxos (features/flowAutomations/leadAction.ts).
export const ACTION_REQUIRED_PARAMS: Record<string, string[]> = {
  send_whatsapp_message:   ['message'],
  send_audio:              ['media_url'],
  send_image:              ['media_url'],
  send_video:              ['media_url'],
  send_document:           ['media_url'],
  send_sticker:            ['media_url'],
  // Desde 05/10/2026 o funil é o de conversa (`flow_automation_id`); a ação
  // antiga com `funnel_id` continua valendo (ver missingActionParams).
  send_message_funnel:     ['flow_automation_id'],
  start_followup_sequence: ['sequence_slug'],
  start_followup_flow:     ['flow_automation_id'],
  assign_broker:           ['user_id'],
  add_label:               ['label_id'],
  remove_label:            ['label_id'],
  move_pipeline_stage:     ['stage_id'],
  create_task:             ['title'],
  notify_group:            ['group_jid', 'message'],
  notify_user:             ['user_id', 'message'],
  send_quick_reply:        ['quick_reply_id'],
  notify_broker:           ['message'],
  notify_gestor:           ['message'],
  notify_push:             ['user_ids', 'message'],
  // "Distribuir pela roleta" (roleta nova, 06/10/2026): a roleta não tem número,
  // então a ação ESCOLHE a roleta.
  assign_via_roleta:       ['roleta_config_id'],
  // wait não tem params obrigatórios.
};

/** Os params obrigatórios da ação que estão vazios, na ordem do mapa. */
export function missingActionParams(
  action: { type: string; params?: Record<string, unknown> | null },
): string[] {
  const empty = (value: unknown) =>
    value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  // "Disparar funil de mensagens" no formato antigo (funil do editor de antes):
  // o `funnel_id` sozinho ainda é ação completa.
  if (action.type === 'send_message_funnel' && empty(action.params?.flow_automation_id) && !empty(action.params?.funnel_id)) {
    return [];
  }
  const required = ACTION_REQUIRED_PARAMS[action.type] ?? [];
  return required.filter(key => empty(action.params?.[key]));
}
