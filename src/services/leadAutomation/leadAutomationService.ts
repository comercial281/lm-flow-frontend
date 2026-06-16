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
  async getAll(): Promise<LeadAutomationRule[]> {
    const res = await api.get(BASE);
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
};

// Triggers emitidos pelo backend Rails (LeadAutomationExecutorJob.perform_later).
// 'lead.no_reply_after' está no model mas nenhum job emite — removido da UI.
export const TRIGGER_LABELS: Record<string, string> = {
  'lead.created':              'Lead criado',
  'lead.meta_ads_lead':        'Lead via Meta Ads',
  'lead.stage_changed':        'Estagio alterado',
  'lead.visit_scheduled':      'Visita agendada',
  'lead.visit_completed':      'Visita realizada',
  'lead.visit_reminder_24h':   'Lembrete - 1 dia antes da visita',
  'lead.visit_reminder_1h':    'Lembrete - 1 hora antes da visita',
  'lead.visit_reminder_15min': 'Lembrete - 15 minutos antes da visita',
  'lead.interest_created':     'Interesse em imovel',
  'lead.inactive_7d':          'Inativo ha 7 dias',
  'lead.inactive_14d':         'Inativo ha 14 dias',
  'lead.property_matched':     'Imovel compativel encontrado',
  'lead.tag_added':            'Etiqueta adicionada',
  'lead.message_received':     'Mensagem recebida do lead',
  'lead.keyword_detected':     'Palavra-chave detectada na mensagem',
  'lead.recovered':            'Lead recuperado (respondeu durante follow-up)',
};

// Actions processadas pelo LeadAutomation::Executor.
export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_whatsapp_message:   'Enviar mensagem WhatsApp',
  send_audio:              'Enviar audio',
  send_image:              'Enviar imagem',
  send_video:              'Enviar video',
  send_document:           'Enviar documento',
  start_followup_sequence: 'Iniciar sequencia de follow-up',
  assign_broker:           'Atribuir corretor',
  assign_via_roleta:       'Distribuir via roleta',
  add_label:               'Adicionar etiqueta',
  remove_label:            'Remover etiqueta',
  move_pipeline_stage:     'Mover no pipeline',
  create_task:             'Criar tarefa',
  notify_group:            'Notificar grupo',
  notify_broker:           'Notificar corretor (WhatsApp pessoal)',
  notify_gestor:           'Notificar gestor (WhatsApp)',
  send_quick_reply:        'Enviar resposta rapida',
  wait:                    'Aguardar (delay)',
};
