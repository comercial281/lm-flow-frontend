import api from '@/services/core/api';

export type FollowupMessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker';

export interface FollowupStep {
  id?: string;
  position: number;
  delay_minutes: number;
  message_type: FollowupMessageType;
  content?: string;
  media_url?: string | null;
  media_caption?: string | null;
  tag_on_send?: string | null;
  move_to_stage_slug?: string | null;
  _destroy?: boolean;
}

export interface FollowupSequence {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  stop_on_reply: boolean;
  business_hours_only: boolean;
  /** Marca no card em que mensagem o lead parou (uma etiqueta por vez) e permite
   *  retomar dali quando ele volta pro funil, em vez de recomeçar da primeira. */
  progress_tagging: boolean;
  /** Exemplo da etiqueta que o funil vai aplicar, vindo do backend. */
  progress_tag_sample?: string | null;
  steps_count: number;
  steps: FollowupStep[];
  created_at: string;
  updated_at: string;
}

export interface FollowupSequenceFormData {
  name: string;
  /** Opcional na criação: o backend deriva do nome e desempata duplicatas. */
  slug?: string;
  description?: string;
  is_active?: boolean;
  stop_on_reply?: boolean;
  business_hours_only?: boolean;
  progress_tagging?: boolean;
  followup_steps_attributes?: FollowupStep[];
}

/** Um funil pronto do catálogo. Vem com o texto dos passos pra tela mostrar a
 *  prévia ANTES de o usuário escolher — escolher às cegas foi o problema que
 *  derrubou o modelo de marketing no CRM de um cliente. */
export interface FollowupTemplate {
  key: string;
  name: string;
  description: string;
  business_hours_only: boolean;
  steps_count: number;
  steps: { position: number; delay_minutes: number; content: string }[];
}

export interface FollowupHistoryEntry {
  id: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  /** epoch em segundos */
  run_at: number | null;
  executed_at: number | null;
  last_error: string | null;
  contact: { id: string | null; name: string | null };
  step: { position: number; message_type: FollowupMessageType; content: string } | null;
}

export interface FollowupHistory {
  sequence: { id: string; name: string; slug: string };
  summary: {
    leads: number;
    pending: number;
    sent: number;
    cancelled: number;
    failed: number;
    /** Cancelados porque o lead respondeu — o único cancelamento que é sucesso. */
    stopped_by_reply: number;
    last_sent_at: number | null;
  };
  recent: FollowupHistoryEntry[];
}

const BASE = '/followup_sequences';

export const followupSequencesService = {
  async getAll(): Promise<FollowupSequence[]> {
    const res = await api.get(BASE);
    return (res.data as { data: FollowupSequence[] }).data ?? [];
  },

  async get(id: string): Promise<FollowupSequence> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: FollowupSequence }).data;
  },

  async create(data: FollowupSequenceFormData): Promise<FollowupSequence> {
    const res = await api.post(BASE, { followup_sequence: data });
    return (res.data as { data: FollowupSequence }).data;
  },

  async update(id: string, data: Partial<FollowupSequenceFormData>): Promise<FollowupSequence> {
    const res = await api.put(`${BASE}/${id}`, { followup_sequence: data });
    return (res.data as { data: FollowupSequence }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async toggle(id: string): Promise<FollowupSequence> {
    const res = await api.post(`${BASE}/${id}/toggle`);
    return (res.data as { data: FollowupSequence }).data;
  },

  async testSend(id: string, phone: string, name = 'Teste'): Promise<{
    contact_id: string;
    sequence_slug: string;
    pending_jobs: number;
  }> {
    const res = await api.post(`${BASE}/${id}/test_send`, null, {
      params: { phone, name },
    });
    return (res.data as { data: { contact_id: string; sequence_slug: string; pending_jobs: number } }).data;
  },

  async getTemplates(): Promise<FollowupTemplate[]> {
    const res = await api.get(`${BASE}/templates`);
    return (res.data as { data: FollowupTemplate[] }).data ?? [];
  },

  /** Cria UM funil a partir do catálogo. Diferente de `reseedTemplate`, não toca
   *  em pipeline, coluna, etiqueta nem regra — só nasce a sequência. */
  async createFromTemplate(templateKey: string, name?: string): Promise<FollowupSequence> {
    const res = await api.post(`${BASE}/create_from_template`, { template_key: templateKey, name });
    return (res.data as { data: FollowupSequence }).data;
  },

  async getHistory(id: string): Promise<FollowupHistory> {
    const res = await api.get(`${BASE}/${id}/history`);
    return (res.data as { data: FollowupHistory }).data;
  },

  async uploadMedia(file: File): Promise<{
    url: string;
    filename: string;
    content_type: string;
    byte_size: number;
  }> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`${BASE}/upload_media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as { data: { url: string; filename: string; content_type: string; byte_size: number } }).data;
  },
};

// Apply template — endpoint REST autenticado (admin only). Substituiu
// /_admin/followup/reseed_template (que ainda existe como fallback).
export const followupAdminService = {
  async reseedTemplate(): Promise<{
    pipeline_id: string;
    pipeline_name: string;
    stages_count: number;
    sequences: string[];
    labels_count: number;
  }> {
    const res = await api.post(`${BASE}/seed_template`);
    return (res.data as {
      data: {
        pipeline_id: string;
        pipeline_name: string;
        stages_count: number;
        sequences: string[];
        labels_count: number;
      };
    }).data;
  },
};

// Pretty labels for the UI
export const MESSAGE_TYPE_LABELS: Record<FollowupMessageType, string> = {
  text:     'Texto',
  audio:    'Áudio',
  image:    'Imagem',
  video:    'Vídeo',
  document: 'Documento',
  sticker:  'Figurinha',
};

// Pretty delay labels (cumulative from sequence start)
export const formatDelay = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};
