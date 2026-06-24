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

export interface LeadAutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  conditions: LeadAutomationCondition[];
  actions: LeadAutomationAction[];
  is_active: boolean;
  archived?: boolean;
  archived_at?: string | null;
  priority: number;
  pipeline_id?: string | null;
  created_by?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface LeadAutomationRuleFormData {
  name: string;
  description?: string;
  trigger: string;
  conditions: LeadAutomationCondition[];
  actions: LeadAutomationAction[];
  is_active: boolean;
  priority: number;
  pipeline_id?: string | null;
}

const BASE = '/lead_automation_rules';

export const leadAutomationService = {
  async getAll(archived = false): Promise<LeadAutomationRule[]> {
    const res = await api.get(BASE, { params: archived ? { archived: 'true' } : {} });
    return (res.data as { data: LeadAutomationRule[] }).data ?? [];
  },

  async create(data: LeadAutomationRuleFormData): Promise<LeadAutomationRule> {
    const res = await api.post(BASE, { lead_automation_rule: data });
    return (res.data as { data: LeadAutomationRule }).data;
  },

  async update(id: string, data: Partial<LeadAutomationRuleFormData>): Promise<LeadAutomationRule> {
    const res = await api.put(`${BASE}/${id}`, { lead_automation_rule: data });
    return (res.data as { data: LeadAutomationRule }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async toggle(id: string): Promise<LeadAutomationRule> {
    const res = await api.post(`${BASE}/${id}/toggle`);
    return (res.data as { data: LeadAutomationRule }).data;
  },

  async archive(id: string): Promise<LeadAutomationRule> {
    const res = await api.post(`${BASE}/${id}/archive`);
    return (res.data as { data: LeadAutomationRule }).data;
  },

  async unarchive(id: string): Promise<LeadAutomationRule> {
    const res = await api.post(`${BASE}/${id}/unarchive`);
    return (res.data as { data: LeadAutomationRule }).data;
  },

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
  async getGroups(instance?: string): Promise<WaGroup[]> {
    const res = await api.get(`${BASE}/groups`, { params: instance ? { instance } : {} });
    return (res.data as { data: { groups: WaGroup[] } }).data?.groups ?? [];
  },
};

export interface WaGroup {
  id: string;   // JID …@g.us
  name: string;
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
  'lead.stage_changed':        'Estágio alterado',
  'lead.visit_scheduled':      'Visita agendada',
  'lead.visit_completed':      'Visita realizada',
  'lead.visit_reminder_24h':   'Lembrete — 1 dia antes da visita',
  'lead.visit_reminder_1h':    'Lembrete — 1 hora antes da visita',
  'lead.visit_reminder_15min': 'Lembrete — 15 minutos antes da visita',
  'lead.interest_created':     'Interesse em imóvel',
  'lead.inactive_7d':          'Inativo há 7 dias',
  'lead.inactive_14d':         'Inativo há 14 dias',
  'lead.property_matched':     'Imóvel compatível encontrado',
  'lead.tag_added':            'Etiqueta adicionada',
  'lead.message_received':     'Mensagem recebida do lead',
  'lead.campaign_received':    'Lead Whats Meta (anúncio no WhatsApp / CTWA)',
  'lead.no_reply_after':       'Sem resposta após X minutos',
};

// Actions processadas pelo LeadAutomation::Executor.
export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_whatsapp_message:   'Enviar mensagem WhatsApp',
  send_audio:              'Enviar audio',
  send_image:              'Enviar imagem',
  send_video:              'Enviar video',
  send_document:           'Enviar documento',
  send_sticker:            'Enviar figurinha',
  send_message_funnel:     'Disparar funil de mensagens',
  start_followup_sequence: 'Iniciar sequencia de follow-up',
  assign_broker:           'Atribuir corretor',
  assign_via_roleta:       'Distribuir via roleta',
  add_label:               'Adicionar etiqueta',
  remove_label:            'Remover etiqueta',
  move_pipeline_stage:     'Mover no pipeline',
  create_task:             'Criar tarefa',
  notify_group:            'Notificar grupo',
  notify_user:             'Avisar usuário no WhatsApp (lembrete)',
  notify_broker:           'Notificar corretor (WhatsApp pessoal)',
  notify_gestor:           'Notificar gestor (WhatsApp)',
  send_quick_reply:        'Enviar resposta rapida',
  wait:                    'Aguardar (delay)',
};
