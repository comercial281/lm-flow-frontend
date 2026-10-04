import api from '@/services/core/api';

// Chat de suporte — lado do CLIENTE. Token e X-Tenant vêm do interceptor do
// core. FormData vai sem Content-Type à mão: o interceptor deixa o axios pôr o
// boundary (ver api.formData.spec.ts).

export type SupportKind = 'question' | 'bug' | 'suggestion';
export type SupportStatus = 'open' | 'waiting_customer' | 'resolved';

export interface SupportMessage {
  id: string;
  author_side: 'customer' | 'team';
  author_name: string | null;
  body: string;
  created_at: string;
  images: string[];
}

export interface SupportTicketSummary {
  id: string;
  kind: SupportKind;
  status: SupportStatus;
  subject: string;
  faq_topic: string | null;
  page_url: string | null;
  last_message_at: string;
  created_at: string;
  unread: boolean;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  messages: SupportMessage[];
}

export interface NovoChamado {
  kind: SupportKind;
  body: string;
  subject?: string;
  faqTopic?: string;
  pageUrl?: string;
  imagens: File[];
}

export function formulario(campos: Record<string, string | undefined>, imagens: File[]): FormData {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(campos)) if (valor) form.append(chave, valor);
  for (const img of imagens) form.append('images[]', img);
  return form;
}

/** A frase que o servidor mandou (`error`), ou a padrão. */
export function erroDaApi(e: unknown, padrao: string): string {
  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof msg === 'string' && msg.trim() ? msg : padrao;
}

export const supportService = {
  async list(): Promise<SupportTicketSummary[]> {
    const { data } = await api.get('/support_tickets');
    return data.data;
  },
  async unreadCount(): Promise<number> {
    const { data } = await api.get('/support_tickets/unread_count');
    return data.data.count;
  },
  async show(id: string): Promise<SupportTicketDetail> {
    const { data } = await api.get(`/support_tickets/${id}`);
    return data.data;
  },
  async open(input: NovoChamado): Promise<SupportTicketDetail> {
    const form = formulario(
      { kind: input.kind, body: input.body, subject: input.subject, faq_topic: input.faqTopic, page_url: input.pageUrl },
      input.imagens,
    );
    const { data } = await api.post('/support_tickets', form);
    return data.data;
  },
  async reply(id: string, body: string, imagens: File[]): Promise<SupportTicketDetail> {
    const { data } = await api.post(`/support_tickets/${id}/messages`, formulario({ body }, imagens));
    return data.data;
  },
};
