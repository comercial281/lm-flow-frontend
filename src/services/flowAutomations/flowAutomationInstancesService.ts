import api from '@/services/core/api';
import type { FlowAutomationKind } from '@/types/flowAutomations';

/**
 * Os fluxos do construtor rodando para UM lead — o que a faixa acima do campo
 * de mensagem mostra (03/10/2026). O caminho vai SEM `/api/v1`: a baseURL do
 * cliente HTTP já tem.
 */
export type FlowInstancePhase = 'waiting_reply' | 'waiting' | 'running' | 'paused' | 'queued';

export interface RunningFlow {
  id: string;
  flow_automation_id: string;
  flow_name: string | null;
  state: string;
  active: boolean;
  phase: FlowInstancePhase;
  /** Fim da espera, epoch em segundos. Na fase `queued`, a vez do número no gotejamento. */
  until: number | null;
  /** Fase `paused`: por que o follow-up parou ("Número desconectado"…). */
  paused_reason?: string | null;
  started_at: number | null;
  /** Sprint 3: `followup` = fluxo da aba Follow-up (a faixa e o card falam "Follow-up"). Ausente = automação. */
  kind?: FlowAutomationKind | null;
  /** Sprint 3: o N do último "Marcar progresso" que o fluxo mandou (null sem marca). */
  progress_step?: number | null;
}

/** Um follow-up que o card pode iniciar (`meta.startable_followups`, sprint 3). */
export interface StartableFollowup {
  id: string;
  name: string;
  /**
   * Fase 3: `true` = da equipe; `false` = do próprio responsável pelo lead.
   * Ausente (lista de `meta.startable_followups` do card) = sem selo.
   */
  team?: boolean;
}

/**
 * O lead que vai pro follow-up (Fase 2, 20/10/2026): o card quando a porta é o
 * funil, a conversa no painel, o contato no resto. Vai tudo o que houver.
 */
export interface RefDoLead {
  contactId?: string | null;
  conversationId?: string | null;
  pipelineItemId?: string | null;
}

/** Onde o lead parou num follow-up (`progress` da prévia). */
export interface ProgressoDoFollowup {
  flow_automation_id: string;
  step: number;
  total: number;
  /** Existe a mensagem `step + 1`: é ISTO que oferece "Continuar" (não o texto). */
  has_next: boolean;
  /** O texto da próxima; nulo quando ela é só mídia (ou não existe). */
  next_text: string | null;
}

/** O que a janela "Colocar em follow-up" precisa saber antes de abrir. */
export interface PlacePreview {
  default_flow_id: string | null;
  options: StartableFollowup[];
  current: { flow_automation_id: string | null; flow_name: string | null; phase: string | null } | null;
  progress: ProgressoDoFollowup | null;
  has_followup_column: boolean;
}

export type ModoDoFollowup = 'restart' | 'continue';

const BASE = '/flow_automation_instances';

const paramsDoLead = (ref: RefDoLead) => ({
  ...(ref.pipelineItemId ? { pipeline_item_id: ref.pipelineItemId } : {}),
  ...(ref.contactId ? { contact_id: ref.contactId } : {}),
  ...(ref.conversationId ? { conversation_id: ref.conversationId } : {}),
});

const textoOuNulo = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

const previewFrom = (body: unknown): PlacePreview => {
  const raw = (body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body) as
    Record<string, unknown> | null;
  const options = Array.isArray(raw?.options)
    ? (raw.options as Array<{ id?: unknown; name?: unknown; team?: unknown } | null>).flatMap(o =>
      o && o.id != null
        ? [{ id: String(o.id), name: String(o.name ?? ''), ...(typeof o.team === 'boolean' ? { team: o.team } : {}) }]
        : [])
    : [];
  const current = raw?.current as { flow_automation_id?: unknown; flow_name?: unknown; phase?: unknown } | null | undefined;
  const progress = raw?.progress as Record<string, unknown> | null | undefined;
  return {
    default_flow_id: raw?.default_flow_id != null ? String(raw.default_flow_id) : null,
    options,
    current: current
      ? {
        flow_automation_id: current.flow_automation_id != null ? String(current.flow_automation_id) : null,
        flow_name: textoOuNulo(current.flow_name),
        phase: textoOuNulo(current.phase),
      }
      : null,
    progress: progress && progress.flow_automation_id != null
      ? {
        flow_automation_id: String(progress.flow_automation_id),
        step: Number(progress.step) || 0,
        total: Number(progress.total) || 0,
        has_next: progress.has_next === true,
        next_text: textoOuNulo(progress.next_text),
      }
      : null,
    has_followup_column: raw?.has_followup_column === true,
  };
};

const startableFrom = (body: unknown): StartableFollowup[] => {
  const meta = body && typeof body === 'object' ? (body as { meta?: { startable_followups?: unknown } }).meta : undefined;
  const list = meta?.startable_followups;
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    const raw = item as { id?: unknown; name?: unknown } | null;
    return raw && raw.id ? [{ id: String(raw.id), name: String(raw.name ?? '') }] : [];
  });
};

const listFrom = (body: unknown): RunningFlow[] => {
  const data = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;
  return Array.isArray(data) ? (data as RunningFlow[]) : [];
};

export const flowAutomationInstancesService = {
  async running(ref: { conversationId?: string | null; contactId?: string | null }): Promise<RunningFlow[]> {
    const params = ref.contactId ? { contact_id: ref.contactId } : { conversation_id: ref.conversationId };
    const { data } = await api.get(BASE, { params });
    return listFrom(data);
  },

  /**
   * Os fluxos rodando e os follow-ups que dá pra iniciar, numa leitura só. A
   * lista do "Iniciar" vem daqui (e não de `/flow_automations`) porque o
   * corretor não lê o construtor; esta rota pede só `pipelines.read`.
   */
  async forCard(ref: { conversationId?: string | null; contactId?: string | null }): Promise<{ flows: RunningFlow[]; startable: StartableFollowup[] }> {
    const params = ref.contactId ? { contact_id: ref.contactId } : { conversation_id: ref.conversationId };
    const { data } = await api.get(BASE, { params });
    return { flows: listFrom(data), startable: startableFrom(data) };
  },

  /** Põe o lead num fluxo agora (o "Iniciar" do card), pela mesma trava de reentrada do gatilho. */
  /**
   * Sprint 4: o "Disparar" do funil de conversa usa a mesma rota, com a conversa
   * (as mensagens saem pelo número dela). `started` = 201 (começou agora); 200 =
   * o lead já estava no funil (a mensagem diz isso).
   */
  async start(ref: { conversationId?: string | null; contactId?: string | null }, flowAutomationId: string): Promise<{ message?: string; started: boolean }> {
    // Os dois quando há: o contato acha o lead, a conversa diz por onde a mensagem sai.
    const lead = {
      ...(ref.contactId ? { contact_id: ref.contactId } : {}),
      ...(ref.conversationId ? { conversation_id: ref.conversationId } : {}),
    };
    const res = await api.post(`${BASE}/start`, { ...lead, flow_automation_id: flowAutomationId });
    return { message: (res.data as { message?: string } | null)?.message, started: res.status !== 200 };
  },

  /** A prévia da janela "Colocar em follow-up": opções, o padrão, onde o lead parou e se o funil tem a coluna. */
  async placePreview(ref: RefDoLead): Promise<PlacePreview> {
    const { data } = await api.get(`${BASE}/place_preview`, { params: paramsDoLead(ref) });
    return previewFrom(data);
  },

  /**
   * Coloca o lead no follow-up escolhido (a ação única do servidor, que também
   * leva o card pra coluna Follow-up). 201 = começou; 200 = já estava nele.
   */
  async place(
    ref: RefDoLead,
    escolha: { flowAutomationId?: string | null; mode: ModoDoFollowup },
  ): Promise<{ message?: string; started: boolean }> {
    const res = await api.post(`${BASE}/place`, {
      ...paramsDoLead(ref),
      ...(escolha.flowAutomationId ? { flow_automation_id: escolha.flowAutomationId } : {}),
      mode: escolha.mode,
    });
    return { message: (res.data as { message?: string } | null)?.message, started: res.status !== 200 };
  },

  async stop(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`${BASE}/${id}/stop`);
    return { message: (data as { message?: string } | null)?.message };
  },

  /** Retoma o follow-up pausado. A frase do servidor ("Follow-up retomado.") vai pro aviso. */
  async resume(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`${BASE}/${id}/resume`);
    return { message: (data as { message?: string } | null)?.message };
  },
};
