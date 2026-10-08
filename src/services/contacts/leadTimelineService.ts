// src/services/contacts/leadTimelineService.ts
//
// O Histórico novo do lead (E5 do funil): GET /contacts/:id/timeline. O servidor
// manda cada linha pronta, em português; a tela só desenha. O `category` de cada
// evento é a FAMÍLIA dele — o filtro "Tudo" (resumo) junta famílias, então a tela
// pede o filtro ao servidor e nunca filtra pelo `category` do evento.
import api from '@/services/core/api';

export type LeadTimelineCategory = 'resumo' | 'atividade' | 'observacao' | 'rodizio' | 'alteracao';
export type LeadTimelineTone = 'neutral' | 'success' | 'danger' | 'warning';

export interface LeadTimelineEvent {
  id: string;
  category: LeadTimelineCategory;
  kind: string;
  title: string;
  detail: string | null;
  actor: string | null;
  occurred_at: string;
  pipeline_name: string | null;
  tone: LeadTimelineTone;
}

export interface LeadTimelinePage {
  events: LeadTimelineEvent[];
  /** Instante do último evento da página (UTC, "Z"): vai cru no próximo `before`. null = acabou. */
  next_before: string | null;
}

export interface LeadTimelineQuery {
  category?: LeadTimelineCategory;
  before?: string | null;
  limit?: number;
}

export const leadTimelineService = {
  async list(contactId: string, { category, before, limit }: LeadTimelineQuery = {}): Promise<LeadTimelinePage> {
    const params: Record<string, string | number> = {};
    if (category) params.category = category;
    if (before) params.before = before;
    if (limit) params.limit = limit;
    const res = await api.get(`/contacts/${contactId}/timeline`, { params });
    // Envelope da casa: { success, data: { events, next_before }, meta }.
    const data = ((res.data as { data?: Partial<LeadTimelinePage> } | undefined)?.data ?? {}) as Partial<LeadTimelinePage>;
    return { events: Array.isArray(data.events) ? data.events : [], next_before: data.next_before ?? null };
  },
};
