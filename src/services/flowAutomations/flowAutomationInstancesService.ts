import api from '@/services/core/api';

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
}

const BASE = '/flow_automation_instances';

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

  async stop(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`${BASE}/${id}/stop`);
    return { message: (data as { message?: string } | null)?.message };
  },
};
