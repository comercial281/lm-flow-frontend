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

export const TRIGGER_LABELS: Record<string, string> = {
  'lead.created':          'Lead criado',
  'lead.stage_changed':    'Estágio alterado',
  'lead.visit_scheduled':  'Visita agendada',
  'lead.visit_completed':  'Visita realizada',
  'lead.interest_created': 'Interesse em imóvel',
  'lead.inactive_7d':      'Inativo há 7 dias',
  'lead.inactive_14d':     'Inativo há 14 dias',
  'lead.property_matched': 'Imóvel compatível encontrado',
  'lead.tag_added':        'Etiqueta adicionada',
  'lead.message_received': 'Mensagem recebida do lead',
  'lead.no_reply_after':   'Sem resposta após período',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_whatsapp_message:   'Enviar mensagem WhatsApp',
  send_audio:              'Enviar áudio',
  send_image:              'Enviar imagem',
  send_video:              'Enviar vídeo',
  wait:                    'Aguardar (delay)',
  start_followup_sequence: 'Iniciar sequência de follow-up',
  assign_broker:           'Atribuir corretor',
  add_label:               'Adicionar etiqueta',
  remove_label:            'Remover etiqueta',
  move_pipeline_stage:     'Mover no pipeline',
  create_task:             'Criar tarefa',
  notify_group:            'Notificar grupo',
  send_quick_reply:        'Enviar resposta rápida',
};
