import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export type AudienceMode = 'pipeline' | 'stage' | 'manual' | 'tag';
export type BroadcastStatus = 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface BroadcastVariation {
  kind: 'text' | 'image' | 'audio' | 'video';
  text: string;
  media_url?: string;
}

// Item de uma SEQUÊNCIA de disparo (mesmo shape do funil de mensagens).
// Substitui as antigas "variações" A/B: o disparo manda os N itens em ordem,
// com delay por item, por destinatário. Ver MessageSequenceEditor.
export interface BroadcastSequenceItem {
  position: number;
  kind: 'text' | 'audio' | 'image' | 'video' | 'document' | 'delay';
  text_content: string | null;
  /** Variações extras do texto; o backend sorteia uma por destinatário. */
  text_variations?: string[];
  media_url: string | null;
  media_caption: string | null;
  media_filename: string | null;
  delay_seconds: number;
}

export interface BroadcastCampaign {
  id: string;
  name: string;
  pipeline_id: string | null;
  status: BroadcastStatus;
  variations: BroadcastVariation[];
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_seconds: number;
  business_hours_only: boolean;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  next_run_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface BroadcastAudience {
  mode: AudienceMode;
  stage_id?: string;
  contact_ids?: string[];
  /** Etiquetas (tags) da conversa quando mode === 'tag'. Match em qualquer uma. */
  labels?: string[];
}

/** Canal de saída do disparo: Evolution (sessão livre) ou WhatsApp Oficial (Cloud API, template aprovado). */
export type BroadcastChannelKind = 'evolution' | 'whatsapp_cloud';

/** Config do disparo pelo canal OFICIAL: template aprovado + variáveis (ordem = {{1}},{{2}}...). */
export interface BroadcastTemplateConfig {
  inbox_id?: string;
  template_name: string;
  language?: string;
  parameters?: string[];
}

/** Template aprovado de um canal oficial (WhatsApp Cloud). */
export interface CloudTemplateOption {
  name: string;
  language: string;
  category?: string;
  status?: string;
  approved: boolean;
  variables: string[];
  variable_count: number;
  content: string;
}

/** Canal oficial (WhatsApp Cloud) conectado + seus templates. */
export interface CloudChannelOption {
  inbox_id: string;
  name: string;
  phone_number: string;
  templates: CloudTemplateOption[];
}

/** Métricas de um número oficial (WhatsApp Cloud) — Meta analytics + custo real. */
export interface CloudMetricsDaily {
  date: string;
  sent: number;
  delivered: number;
  cost: number;
}
export interface CloudMetricsChannel {
  inbox_id: string;
  name: string;
  phone_number: string;
  quality_rating: string | null;
  messaging_tier: string | number | null;
  templates_by_category: Record<string, number>;
  totals: { sent: number; delivered: number; cost: number };
  daily: CloudMetricsDaily[];
}
export interface CloudMetrics {
  range: { days: number };
  channels: CloudMetricsChannel[];
  totals: { sent: number; delivered: number; cost: number };
}

export interface CreateBroadcastPayload {
  name?: string;
  pipeline_id: string;
  audience: BroadcastAudience;
  /** Canal de saída. Default evolution. */
  channel_kind?: BroadcastChannelKind;
  /** Config do template quando channel_kind === 'whatsapp_cloud'. */
  template_config?: BroadcastTemplateConfig;
  /** Sequência de itens (modo novo, unificado com o funil). */
  funnel_items?: BroadcastSequenceItem[];
  /** Variações A/B legadas (mantido só pra compat de campanhas antigas). */
  variations?: BroadcastVariation[];
  /** Destino pós-envio: mover pra etapa + criar/aplicar tag. */
  post_send?: { stage_id?: string; label?: string };
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_seconds: number;
  business_hours_only: boolean;
}

class BroadcastsService {
  private base = '/broadcasts';

  async list(pipelineId: string): Promise<BroadcastCampaign[]> {
    const res = await api.get(this.base, { params: { pipeline_id: pipelineId } });
    return extractData<BroadcastCampaign[]>(res) || [];
  }

  async create(payload: CreateBroadcastPayload): Promise<BroadcastCampaign> {
    const res = await api.post(this.base, payload);
    return extractData<BroadcastCampaign>(res);
  }

  async audiencePreview(pipelineId: string, audience: BroadcastAudience): Promise<number> {
    const res = await api.post(`${this.base}/audience_preview`, {
      pipeline_id: pipelineId,
      audience,
    });
    return extractData<{ count: number }>(res)?.count ?? 0;
  }

  async pause(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/pause`));
  }

  async resume(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/resume`));
  }

  async cancel(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.post(`${this.base}/${id}/cancel`));
  }

  async uploadMedia(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`${this.base}/upload_media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<{ url: string }>(res);
  }

  async testSend(phone: string, variation: BroadcastVariation): Promise<void> {
    await api.post(`${this.base}/test_send`, {
      phone,
      kind: variation.kind,
      text: variation.text,
      media_url: variation.media_url,
    });
  }

  // Manda a SEQUÊNCIA inteira só pra um número de teste (sem criar campanha).
  async testSendSequence(phone: string, items: BroadcastSequenceItem[]): Promise<void> {
    await api.post(`${this.base}/test_send`, { phone, funnel_items: items });
  }

  // Canais OFICIAIS (WhatsApp Cloud) conectados + templates aprovados, pra UI de disparo.
  async whatsappCloudOptions(): Promise<CloudChannelOption[]> {
    const res = await api.get(`${this.base}/whatsapp_cloud_options`);
    return extractData<CloudChannelOption[]>(res) || [];
  }

  // Manda UM template aprovado só pra um número de teste (canal oficial).
  async testSendTemplate(phone: string, tc: BroadcastTemplateConfig): Promise<void> {
    await api.post(`${this.base}/test_send`, {
      phone,
      channel_kind: 'whatsapp_cloud',
      template_config: tc,
    });
  }

  // Métricas dos números oficiais (Meta analytics + custo real). Fase 1.
  async whatsappCloudMetrics(days = 30): Promise<CloudMetrics | null> {
    const res = await api.get(`${this.base}/whatsapp_cloud_metrics`, { params: { days } });
    return extractData<CloudMetrics>(res);
  }
}

export const broadcastsService = new BroadcastsService();
