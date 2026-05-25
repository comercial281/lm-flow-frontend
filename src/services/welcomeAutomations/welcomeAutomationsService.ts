import api from '@/services/core/api';

export interface WelcomeAutomation {
  id: string;
  name: string;
  template_body: string;
  trigger: 'new_conversation' | 'first_inbound_message';
  is_active: boolean;
  delay_seconds: number;
  inbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WelcomeAutomationFormData {
  name: string;
  template_body: string;
  trigger: 'new_conversation' | 'first_inbound_message';
  is_active: boolean;
  delay_seconds: number;
  inbox_id?: string | null;
}

class WelcomeAutomationsService {
  private readonly base = '/welcome_automations';

  async getAll(): Promise<WelcomeAutomation[]> {
    const res = await api.get(this.base);
    return (res.data as { data: WelcomeAutomation[] }).data ?? [];
  }

  async create(data: WelcomeAutomationFormData): Promise<WelcomeAutomation> {
    const res = await api.post(this.base, { welcome_automation: data });
    return (res.data as { data: WelcomeAutomation }).data;
  }

  async update(id: string, data: Partial<WelcomeAutomationFormData>): Promise<WelcomeAutomation> {
    const res = await api.patch(`${this.base}/${id}`, { welcome_automation: data });
    return (res.data as { data: WelcomeAutomation }).data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.base}/${id}`);
  }
}

export const welcomeAutomationsService = new WelcomeAutomationsService();
