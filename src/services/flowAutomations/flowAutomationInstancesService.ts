import api from '@/services/core/api';
import type { FlowAutomationKind } from '@/types/flowAutomations';

/**
 * Os fluxos do construtor rodando para UM lead — o que a faixa acima do campo
 * de mensagem mostra (03/10/2026). O caminho vai SEM `/api/v1`: a baseURL do
 * cliente HTTP já tem.
 */
export type FlowInstancePhase = 'waiting_reply' | 'waiting' | 'running';

export interface RunningFlow {
  id: string;
  flow_automation_id: string;
  flow_name: string | null;
  state: string;
  active: boolean;
  phase: FlowInstancePhase;
  /** Fim da espera, epoch em segundos. */
  until: number | null;
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
}

const BASE = '/flow_automation_instances';

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
  async start(ref: { conversationId?: string | null; contactId?: string | null }, flowAutomationId: string): Promise<{ message?: string }> {
    // Os dois quando há: o contato acha o lead, a conversa diz por onde a mensagem sai.
    const lead = {
      ...(ref.contactId ? { contact_id: ref.contactId } : {}),
      ...(ref.conversationId ? { conversation_id: ref.conversationId } : {}),
    };
    const { data } = await api.post(`${BASE}/start`, { ...lead, flow_automation_id: flowAutomationId });
    return { message: (data as { message?: string } | null)?.message };
  },

  async stop(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`${BASE}/${id}/stop`);
    return { message: (data as { message?: string } | null)?.message };
  },
};
