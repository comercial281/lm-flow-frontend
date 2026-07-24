import api from '@/services/core/api';

// Caixa de entrada de Sugestões/Bugs dos clientes (aba do admin). Lê tudo
// agregado do backend e permite triar status + nota interna e arquivar.

export type FeedbackKind = 'suggestion' | 'bug';
export type FeedbackStatus = 'new' | 'in_review' | 'resolved';

export interface CustomerFeedback {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  tenant_slug?: string | null;
  page_url?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  admin_note?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

interface Env<T> {
  success: boolean;
  data: T;
  error?: string;
}

function unwrap<T>(res: { data: unknown }): T {
  return (res.data as Env<T>).data;
}

export const customerFeedbackService = {
  async list(filters: { status?: FeedbackStatus; kind?: FeedbackKind } = {}): Promise<CustomerFeedback[]> {
    const res = await api.get('/super/customer_feedbacks', { params: filters });
    return unwrap<CustomerFeedback[]>(res);
  },
  async update(
    id: string,
    input: { status?: FeedbackStatus; admin_note?: string },
  ): Promise<CustomerFeedback> {
    const res = await api.put(`/super/customer_feedbacks/${id}`, input);
    return unwrap<CustomerFeedback>(res);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/super/customer_feedbacks/${id}`);
  },
};

export const KIND_LABELS: Record<FeedbackKind, string> = {
  suggestion: 'Sugestão',
  bug: 'Bug',
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Novo',
  in_review: 'Em análise',
  resolved: 'Resolvido',
};
