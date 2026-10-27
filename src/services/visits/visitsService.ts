import api from '@/services/core/api';

export interface PersonRef {
  id: string;
  name: string;
}

export interface Visit {
  id: string;
  property_id: string | null;
  contact_id: string;
  realtor_id?: string | null;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
  scheduled_at: string;
  duration_minutes?: number | null;
  realtor_notes?: string | null;
  cancelled_at?: string | null;
  feedback_notes?: string;
  rating?: number | null;
  metadata?: Record<string, unknown> | null;
  property?: { id: string; title: string; code: string; address_city?: string; address_neighborhood?: string };
  contact?: { id: string; name: string; phone_number?: string };
  realtor?: PersonRef | null;
  // Quem agendou: a IA ou uma pessoa. Ausente em servidor antigo.
  booked_by?: 'ia' | 'pessoa' | null;
  created_by?: PersonRef | null;
  created_at: string;
  updated_at: string;
}

export interface VisitFormData {
  property_id?: string | null;
  contact_id: string;
  realtor_id?: string | null;
  scheduled_at: string;
  duration_minutes?: number;
  realtor_notes?: string;
  status?: 'completed';
  rating?: number;
  feedback_notes?: string;
}

const BASE = '/visits';

export const visitsService = {
  async list(params: Record<string, string | string[] | number | undefined> = {}): Promise<{ data: Visit[]; meta: { total: number; only_mine?: boolean; active_total?: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: Visit[]; meta: { total: number; only_mine?: boolean; active_total?: number } };
  },

  async get(id: string): Promise<Visit> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: Visit }).data;
  },

  async create(data: VisitFormData): Promise<Visit> {
    const res = await api.post(BASE, { visit: data });
    return (res.data as { data: Visit }).data;
  },

  async update(id: string, data: Partial<VisitFormData>): Promise<Visit> {
    const res = await api.put(`${BASE}/${id}`, { visit: data });
    return (res.data as { data: Visit }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async confirm(id: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/confirm`);
    return (res.data as { data: Visit }).data;
  },

  async complete(id: string, rating?: number, feedback?: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/complete`, { rating, feedback_notes: feedback });
    return (res.data as { data: Visit }).data;
  },

  /**
   * Retorno de visita já Realizada: grava só nota e/ou comentário. Não mexe na
   * data de realização nem dispara automação. 422 se a visita não está
   * Realizada ou se não veio nada pra salvar.
   */
  async feedback(id: string, rating?: number, feedbackNotes?: string): Promise<Visit> {
    const body: { rating?: number; feedback_notes?: string } = {};
    if (rating !== undefined) body.rating = rating;
    if (feedbackNotes !== undefined) body.feedback_notes = feedbackNotes;
    const res = await api.post(`${BASE}/${id}/feedback`, body);
    return (res.data as { data: Visit }).data;
  },

  async cancel(id: string, reason?: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/cancel`, { reason });
    return (res.data as { data: Visit }).data;
  },

  /** Remarcar: só horário futuro; o gestor pode trocar corretor e duração junto. */
  async reschedule(id: string, scheduled_at: string, opts: { duration_minutes?: number; realtor_id?: string } = {}): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/reschedule`, { scheduled_at, ...opts });
    return (res.data as { data: Visit }).data;
  },

  /** O cliente não veio. Só depois do horário; libera a agenda e para os lembretes. */
  async noShow(id: string): Promise<Visit> {
    const res = await api.post(`${BASE}/${id}/no_show`);
    return (res.data as { data: Visit }).data;
  },

  async leadPicker(q: string = '', per_page: number = 20): Promise<LeadPickerItem[]> {
    const res = await api.get(`${BASE}/lead_picker`, { params: { q, per_page } });
    return (res.data as { data: LeadPickerItem[] }).data;
  },

  /**
   * Seletor de cliente paginado (Agendar visita). O meta traz o `total` real do
   * recorte e `has_more`; `only_mine` diz que o corretor está travado nele
   * mesmo (`me`). Para só conferir o cargo, peça `per_page = 1`.
   */
  async leadPickerPage(
    q: string = '',
    page: number = 1,
    per_page: number = 50,
  ): Promise<{ data: LeadPickerItem[]; meta: LeadPickerMeta }> {
    const res = await api.get(`${BASE}/lead_picker`, { params: { q, page, per_page } });
    const body = res.data as { data: LeadPickerItem[]; meta?: LeadPickerMeta };
    return { data: body.data ?? [], meta: body.meta ?? {} };
  },

  /** Corretores que podem receber visita (ativos e visíveis). O corretor isolado recebe só ele mesmo. */
  async realtors(): Promise<PersonRef[]> {
    const res = await api.get(`${BASE}/realtors`);
    return (res.data as { data?: PersonRef[] }).data ?? [];
  },

  /**
   * Resumo do lead da visita (prévia do hover e janela da Agenda). 404 pra quem
   * não vê a visita, e também em servidor antigo sem a rota: a tela mostra o
   * aviso e segue. Guardado por `lerResumoDoLead` (features/visits/guardaDoResumo).
   */
  async leadSummary(id: string): Promise<LeadSummary> {
    const res = await api.get(`${BASE}/${id}/lead_summary`);
    return (res.data as { data: LeadSummary }).data;
  },

  async quickCreateContact(payload: { name: string; phone_number: string; email?: string }): Promise<LeadPickerItem> {
    const res = await api.post(`${BASE}/quick_create_contact`, payload);
    return (res.data as { data: LeadPickerItem }).data;
  },
};

/**
 * Contrato do `GET /visits/:id/lead_summary` (spec da Agenda, 27/10/2026). Cada
 * parte pode vir `null` quando falhou no servidor; `labels` vem `[]`.
 */
export interface LeadSummary {
  contact: { id: string; name: string | null; phone_number: string | null } | null;
  card: {
    pipeline_name: string | null;
    stage_name: string | null;
    status: 'open' | 'won' | 'lost';
    other_cards_count: number;
  } | null;
  origin_label: string | null;
  owner: PersonRef | null;
  labels: Array<{ title: string; color: string }>;
  last_message: {
    author_kind: 'lead' | 'ia' | 'automacao' | 'pessoa';
    author_name: string | null;
    content: string | null;
    created_at: string | null;
  } | null;
  /** A conversa da última mensagem; sem mensagem, a mais recente do lead. */
  conversation_id: string | null;
  ia: {
    summary: string | null;
    fields: Array<{ label: string; value: string }>;
    checklist: Array<{ question: string; answer: string; required: boolean }>;
  } | null;
  previous_visits_count: number | null;
  lead_created_at: string | null;
  card_entered_at: string | null;
}

export interface LeadPickerMeta {
  total?: number;
  page?: number;
  per_page?: number;
  has_more?: boolean;
  only_mine?: boolean;
  me?: PersonRef | null;
}

export interface LeadPickerItem {
  id: string;
  name: string;
  phone_number?: string | null;
  email?: string | null;
  in_pipeline: boolean;
  pipeline_id?: string | null;
  stage_name?: string | null;
  updated_at?: string;
  owner?: PersonRef | null;
}

export const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled:   'Agendada',
  confirmed:   'Confirmada',
  in_progress: 'Em andamento',
  completed:   'Realizada',
  no_show:     'Não compareceu',
  cancelled:   'Cancelada',
  rescheduled: 'Reagendada',
};
