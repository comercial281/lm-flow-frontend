import type { StandardResponse, PaginatedResponse } from '@/types/core';

export type ReminderTriggerType =
  | 'lead_via_webhook'
  | 'tag_added'
  | 'card_moved_to_column'
  | 'no_response_after'
  | 'manual_macro';

export type ReminderDeliveryMode = 'immediate' | 'delayed' | 'recurring';

export type ReminderDestinationType = 'number' | 'group' | 'lead_dm' | 'assigned_member';

export type ReminderContentMode = 'editor_vars' | 'fixed_card';

export interface WhatsappReminder {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: ReminderTriggerType;
  trigger_config: Record<string, any>;
  delivery_mode: ReminderDeliveryMode;
  delivery_config: Record<string, any>;
  destination_type: ReminderDestinationType;
  destination_value: Record<string, any>;
  inbox_id: number | null;
  inbox_name?: string | null;
  content_mode: ReminderContentMode;
  content_template: string | null;
  content_card_layout: string | null;
  created_by_id: number | null;
  updated_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappReminderGroup {
  id: string; // JID '...@g.us'
  name: string;
  participants_count?: number;
}

export interface CreateReminderData {
  name: string;
  enabled: boolean;
  trigger_type: ReminderTriggerType;
  trigger_config?: Record<string, any>;
  delivery_mode: ReminderDeliveryMode;
  delivery_config?: Record<string, any>;
  destination_type: ReminderDestinationType;
  destination_value: Record<string, any>;
  inbox_id: number | null;
  content_mode: ReminderContentMode;
  content_template?: string | null;
  content_card_layout?: string | null;
}

export interface UpdateReminderData extends Partial<CreateReminderData> {
  id: string;
}

export interface ExecuteReminderData {
  reminderId: string;
  conversation_id?: number;
  contact_id?: number;
  context?: Record<string, any>;
}

export type WhatsappRemindersResponse = PaginatedResponse<WhatsappReminder>;
export type WhatsappReminderResponse = StandardResponse<WhatsappReminder>;

export const TRIGGER_LABELS: Record<ReminderTriggerType, string> = {
  lead_via_webhook: 'Lead chegou por formulário ou integração',
  tag_added: 'Etiqueta adicionada ao lead',
  card_moved_to_column: 'Card movido pra coluna',
  no_response_after: 'Sem resposta por X tempo',
  manual_macro: 'Disparo manual (botão)'
};

export const DELIVERY_LABELS: Record<ReminderDeliveryMode, string> = {
  immediate: 'Imediato',
  delayed: 'Com delay',
  recurring: 'Recorrente (cron)'
};

export const DESTINATION_LABELS: Record<ReminderDestinationType, string> = {
  number: 'Número WhatsApp específico',
  group: 'Grupo WhatsApp',
  lead_dm: 'DM pro lead da automação',
  assigned_member: 'DM pro atendente atribuído'
};

export const CONTENT_LABELS: Record<ReminderContentMode, string> = {
  editor_vars: 'Editor com variáveis ({{nome}} etc.)',
  fixed_card: 'Card visual fixo com dados do lead'
};
