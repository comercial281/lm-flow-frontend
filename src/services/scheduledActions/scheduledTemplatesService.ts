import api from '@/services/core/api';

// Templates de mensagem (globais) — reutiliza scheduled_action_templates.
export interface MessageTemplate {
  id: string;
  name: string;
  message: string;
}

// Sequências agendadas salvas (funil de mensagens agendado, globais).
export interface SequenceStep {
  message: string;
  delay_minutes: number;
}
export interface SequenceTemplate {
  id: string;
  name: string;
  steps: SequenceStep[];
}

function unwrap<T>(data: unknown): T[] {
  const d = data as { data?: unknown };
  return Array.isArray(d?.data) ? (d.data as T[]) : Array.isArray(data) ? (data as T[]) : [];
}

export const scheduledTemplatesService = {
  // ---- Templates de mensagem ----
  async listMessages(): Promise<MessageTemplate[]> {
    const res = await api.get('/scheduled_action_templates', { params: { action_type: 'send_message' } });
    return unwrap<any>(res.data).map(t => ({
      id: String(t.id),
      name: t.name,
      message: t.payload?.message ?? '',
    }));
  },

  async createMessage(name: string, message: string): Promise<void> {
    await api.post('/scheduled_action_templates', {
      scheduled_action_template: {
        name,
        action_type: 'send_message',
        is_public: true,
        payload: { message },
      },
    });
  },

  // ---- Sequências salvas ----
  async listSequences(): Promise<SequenceTemplate[]> {
    const res = await api.get('/scheduled_sequence_templates');
    return unwrap<any>(res.data).map(t => ({
      id: String(t.id),
      name: t.name,
      steps: Array.isArray(t.steps) ? t.steps : [],
    }));
  },

  async createSequence(name: string, steps: SequenceStep[]): Promise<void> {
    await api.post('/scheduled_sequence_templates', {
      scheduled_sequence_template: { name, steps },
    });
  },

  async deleteSequence(id: string): Promise<void> {
    await api.delete(`/scheduled_sequence_templates/${id}`);
  },
};
