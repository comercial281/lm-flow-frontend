import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export type AudienceMode = 'pipeline' | 'stage' | 'manual' | 'tag';
export type BroadcastStatus = 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

/** Ritmo do disparo: pacotes fixos (o servidor traduz em intervalo, lote e pausa). */
export type BroadcastPace = 'fast' | 'normal' | 'slow';
export type BroadcastMode = 'flow' | 'message' | 'template' | 'automation';

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
  channel_kind?: BroadcastChannelKind;
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
  delivered_count?: number;
  read_count?: number;
  replied_count?: number;
  max_spend_cents?: number | null;
  frequency_cap_days?: number;
  respect_opt_out?: boolean;
  template_category?: string | null;
  next_run_at: string;
  completed_at: string | null;
  created_at: string;
  pace?: BroadcastPace | null;
  inbox_id?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  flow_automation_id?: string | null;
  flow_name?: string | null;
  mode?: BroadcastMode;
  pause_reason?: BroadcastPauseReason | null;
  /** A frase da pausa automática, pronta pra tela (vem do servidor pra todo motivo). */
  pause_message?: string | null;
  pending_count?: number;
  estimated_finish_at?: string | null;
  created_by_name?: string | null;
}

/**
 * Por que o motor pausou sozinho. A tela não traduz o motivo: mostra o
 * `pause_message` que o servidor manda (motivo novo aparece sem mexer aqui).
 * 'number_removed' = o número de saída escolhido não existe mais.
 */
export type BroadcastPauseReason = 'number_disconnected' | 'number_removed' | 'funnel_disabled' | 'spend_cap' | 'flow_number_changed';

/** Número de WhatsApp que pode mandar o disparo. */
export interface SenderOption {
  inbox_id: string;
  name: string;
  phone: string;
  connection: string;
  owner_name: string | null;
  provider: string;
  sendable: boolean;
  reason?: 'disconnected' | 'unsupported' | null;
}

export type BroadcastItemStatus = 'pending' | 'sending' | 'sent' | 'in_funnel' | 'failed' | 'skipped' | 'cancelled';

export interface BroadcastItemRow {
  id: string;
  lead_name: string | null;
  phone: string | null;
  status: BroadcastItemStatus;
  reason: string | null;
  sent_at: string | null;
  conversation_id: string | null;
  /** Disparo de automação: 'other_number' = entrou, mas pausado porque o lead já conversa em outro número. */
  flow_paused?: 'other_number' | null;
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
  /** Ritmo (pacote). O servidor define intervalo, lote, pausa e os limites fixos. */
  pace: BroadcastPace;
  /** Número de WhatsApp de saída. */
  inbox_id?: string;
  /** Funil de mensagens (fluxo) que o disparo executa. */
  flow_automation_id?: string;
  /** Teto de gasto em REAIS (Fase 4); backend converte pra centavos. */
  max_spend?: number;
  /** Automação: incluir quem já passou por ela (por padrão fica de fora). */
  include_passed?: boolean;
  /** Automação: reiniciar quem está no meio dela (por padrão fica de fora). */
  restart_running?: boolean;
}

/** Estimativa de custo de um disparo oficial (Fase 4). */
export interface CostEstimate {
  count: number;
  category: string;
  rate: number;
  currency: string;
  total: number;
  estimate: boolean;
}

/** Contatos removidos pelos filtros anti-spam no preview (Fase 5). */
export interface AudienceExcluded {
  opt_out: number;
  frequency: number;
  /** Lead de outro corretor naquele número (só com inbox_id). */
  other_owner?: number;
  /** Já está em outro disparo em andamento. */
  busy?: number;
  /** Automação: já está no meio dela. */
  in_this_flow?: number;
  /** Automação: já passou por ela. */
  already_passed?: number;
}

/** Como o jeito de escolher o número de saída está configurado na automação. */
export type NumberMode = 'fixed' | 'personal' | 'inherit' | 'per_block';

/** Automação que pode ser disparada em massa (GET /broadcasts/automation_options). */
export interface AutomationOption {
  id: string;
  name: string;
  team: boolean;
  owner_name: string | null;
  number_mode: NumberMode;
  inbox_id: string | null;
  inbox_name: string | null;
  first_step: { kind: string; text: string | null; config: Record<string, unknown> };
  more_blocks: number;
  trigger_data: Array<'visita' | 'formulario' | 'imovel'>;
}

/** Resumo da audiência diante de uma automação (só vem com flow_automation_id). */
export interface FlowSummary {
  passed: number;
  passed_error: number;
  running: number;
  first_time: number;
}

/** Opções extras do preview quando o disparo roda uma automação. */
export interface AudiencePreviewFlowOptions {
  flow_automation_id?: string;
  include_passed?: boolean;
  restart_running?: boolean;
}

export interface AudiencePreviewFull {
  count: number;
  excluded: Required<Pick<AudienceExcluded, 'opt_out' | 'frequency' | 'other_owner' | 'busy'>> &
    Pick<AudienceExcluded, 'in_this_flow' | 'already_passed'>;
  /** Término previsto (ISO) em cada ritmo. */
  eta: Partial<Record<BroadcastPace, string>>;
  /** Só com automação. */
  flow?: FlowSummary;
  /** Número que a automação impõe (null = o usuário escolhe). */
  forced_inbox?: { inbox_id: string; name: string } | null;
}

/** Lead da lista do painel "Escolher leads" (GET /broadcasts/lead_options). Só quem tem telefone. */
export interface LeadOption {
  contact_id: string;
  name: string | null;
  phone: string;
  stage_name: string | null;
  labels: string[];
}

/** Filtros da lista de leads: funil obrigatório; etapa por id, etiqueta pelo nome. */
export interface LeadOptionsParams {
  pipeline_id: string;
  q?: string;
  stage_id?: string;
  label?: string;
  page?: number;
}

class BroadcastsService {
  private base = '/broadcasts';

  async list(pipelineId: string): Promise<BroadcastCampaign[]> {
    const res = await api.get(this.base, { params: { pipeline_id: pipelineId } });
    return extractData<BroadcastCampaign[]>(res) || [];
  }

  async listAll(params?: { pipeline_id?: string; page?: number }): Promise<{
    data: BroadcastCampaign[];
    meta: { total: number; page: number; per_page: number };
  }> {
    const res = await api.get(this.base, { params });
    const body = res?.data ?? {};
    return {
      data: (body.data as BroadcastCampaign[]) ?? [],
      meta: body.meta ?? { total: 0, page: 1, per_page: 0 },
    };
  }

  async get(id: string): Promise<BroadcastCampaign> {
    return extractData<BroadcastCampaign>(await api.get(`${this.base}/${id}`));
  }

  async senderOptions(): Promise<{ data: SenderOption[]; default_inbox_id: string | null }> {
    const body = (await api.get(`${this.base}/sender_options`))?.data ?? {};
    return { data: body.data ?? [], default_inbox_id: body.default_inbox_id ?? null };
  }

  async audiencePreviewFull(
    pipelineId: string,
    audience: BroadcastAudience,
    inboxId?: string,
    flowOpts?: AudiencePreviewFlowOptions,
  ): Promise<AudiencePreviewFull> {
    const res = await api.post(`${this.base}/audience_preview`, {
      pipeline_id: pipelineId,
      audience,
      inbox_id: inboxId,
      ...(flowOpts?.flow_automation_id !== undefined && { flow_automation_id: flowOpts.flow_automation_id }),
      ...(flowOpts?.include_passed !== undefined && { include_passed: flowOpts.include_passed }),
      ...(flowOpts?.restart_running !== undefined && { restart_running: flowOpts.restart_running }),
    });
    const d = extractData<Partial<AudiencePreviewFull>>(res);
    return {
      count: d?.count ?? 0,
      excluded: { opt_out: 0, frequency: 0, other_owner: 0, busy: 0, ...(d?.excluded ?? {}) },
      eta: d?.eta ?? {},
      ...(d?.flow && { flow: d.flow }),
      forced_inbox: d?.forced_inbox ?? null,
    };
  }

  // Automações que podem ser disparadas em massa (opção "Automação" do passo 2).
  async automationOptions(): Promise<AutomationOption[]> {
    const res = await api.get(`${this.base}/automation_options`);
    const list = extractData<AutomationOption[]>(res);
    return Array.isArray(list) ? list : [];
  }

  // Lista paginada (20 por página) pra marcar lead a lead. Corretor: o servidor recorta os dele.
  async leadOptions(params: LeadOptionsParams): Promise<{
    data: LeadOption[];
    meta: { total: number; page: number; per_page: number };
  }> {
    const limpos = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
    ) as Partial<LeadOptionsParams>;
    const body = (await api.get(`${this.base}/lead_options`, { params: limpos }))?.data ?? {};
    return {
      data: Array.isArray(body.data) ? (body.data as LeadOption[]) : [],
      meta: body.meta ?? { total: 0, page: 1, per_page: 20 },
    };
  }

  async items(
    id: string,
    params?: { status?: BroadcastItemStatus; page?: number },
  ): Promise<{
    data: BroadcastItemRow[];
    meta: { total: number; page: number; per_page: number; counts: Record<string, number> };
  }> {
    const body = (await api.get(`${this.base}/${id}/items`, { params }))?.data ?? {};
    return {
      data: body.data ?? [],
      meta: body.meta ?? { total: 0, page: 1, per_page: 0, counts: {} },
    };
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

  // Preview com detalhe dos excluídos por opt-out/frequency (Fase 5).
  async audiencePreviewDetailed(
    pipelineId: string,
    audience: BroadcastAudience,
    opts?: { respect_opt_out?: boolean; frequency_cap_days?: number },
  ): Promise<{ count: number; excluded: AudienceExcluded }> {
    const res = await api.post(`${this.base}/audience_preview`, {
      pipeline_id: pipelineId,
      audience,
      ...opts,
    });
    const d = extractData<{ count: number; excluded: AudienceExcluded }>(res);
    return { count: d?.count ?? 0, excluded: d?.excluded ?? { opt_out: 0, frequency: 0 } };
  }

  // Estimativa de custo do disparo oficial (Fase 4). Passa count OU audience.
  async estimateCost(params: {
    count?: number;
    category?: string;
    pipeline_id?: string;
    audience?: BroadcastAudience;
    respect_opt_out?: boolean;
    frequency_cap_days?: number;
  }): Promise<CostEstimate | null> {
    const res = await api.post(`${this.base}/estimate_cost`, params);
    return extractData<CostEstimate>(res);
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
  // `inboxId`: o teste sai do número de saída escolhido.
  async testSendSequence(phone: string, items: BroadcastSequenceItem[], inboxId?: string): Promise<void> {
    await api.post(`${this.base}/test_send`, { phone, funnel_items: items, inbox_id: inboxId });
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
