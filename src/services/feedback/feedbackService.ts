import api from '@/services/core/api';

// Envio de Sugestões/Bugs pelo cliente (botão flutuante do CRM). Token e
// X-Tenant já são injetados pelo interceptor do core — nada extra aqui.

export type FeedbackKind = 'suggestion' | 'bug';

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  page_url?: string;
}

export const feedbackService = {
  async submit(input: FeedbackInput): Promise<void> {
    await api.post('/customer_feedbacks', { feedback: input });
  },
};
