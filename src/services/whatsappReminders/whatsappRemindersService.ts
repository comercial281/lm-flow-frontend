import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import type {
  WhatsappReminder,
  WhatsappReminderGroup,
  WhatsappRemindersResponse,
  WhatsappReminderResponse,
  CreateReminderData,
  UpdateReminderData,
  ExecuteReminderData
} from '@/types/automation';

class WhatsappRemindersService {
  async list(params?: { page?: number; per_page?: number; trigger_type?: string; enabled?: boolean }): Promise<WhatsappRemindersResponse> {
    const response = await api.get('/whatsapp_reminders', { params });
    return extractResponse<WhatsappReminder>(response) as WhatsappRemindersResponse;
  }

  async get(id: string): Promise<WhatsappReminderResponse> {
    const response = await api.get(`/whatsapp_reminders/${id}`);
    return extractData<WhatsappReminderResponse>(response);
  }

  async create(data: CreateReminderData): Promise<WhatsappReminderResponse> {
    const response = await api.post('/whatsapp_reminders', data);
    return extractData<WhatsappReminderResponse>(response);
  }

  async update(id: string, data: Partial<UpdateReminderData>): Promise<WhatsappReminderResponse> {
    const response = await api.put(`/whatsapp_reminders/${id}`, data);
    return extractData<WhatsappReminderResponse>(response);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/whatsapp_reminders/${id}`);
  }

  async execute(data: ExecuteReminderData): Promise<{ run_id: string; status: string }> {
    const response = await api.post(`/whatsapp_reminders/${data.reminderId}/execute`, {
      conversation_id: data.conversation_id,
      contact_id: data.contact_id,
      context: data.context || {}
    });
    return extractData<any>(response);
  }

  async listGroups(inboxId: string | number): Promise<WhatsappReminderGroup[]> {
    const response = await api.get('/whatsapp_reminders/groups', { params: { inbox_id: inboxId } });
    const payload: any = extractData(response);
    return (payload?.groups || []) as WhatsappReminderGroup[];
  }
}

export const whatsappRemindersService = new WhatsappRemindersService();
