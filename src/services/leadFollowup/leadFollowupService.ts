import api from '@/services/core/api';

/**
 * O follow-up de UM lead, do jeito que o card precisa: o estado real e os quatro
 * comandos.
 *
 * ⚠️ Os caminhos vão SEM o `/api/v1`: o cliente HTTP já carrega esse prefixo na
 * baseURL. Escrito à mão, a chamada saía como `/api/v1/api/v1/...` e tomava 404
 * em toda abertura de card — o bloco aparecia sempre vazio e o erro só existia
 * no console.
 */

/** running = tem mensagem por sair; paused = segurada à mão; done = funil todo
 *  enviado; idle = não há follow-up rolando (nunca entrou, ou foi parado). */
export type LeadFollowupStatus = 'running' | 'paused' | 'done' | 'idle';

export interface LeadFollowupStep {
  id: string;
  position?: number;
  message_type?: string;
  delay_minutes?: number;
  content?: string;
  tag_on_send?: string | null;
}

export interface LeadFollowupJob {
  id: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed' | 'paused';
  run_at: number | null;
  executed_at: number | null;
  last_error: string | null;
  attempts?: number;
  step: LeadFollowupStep | null;
  sequence: { id?: string; name?: string; slug?: string } | null;
}

export interface LeadFollowupSequenceOption {
  id: string;
  slug: string;
  name: string;
  steps_count: number;
}

export interface LeadFollowupState {
  status: LeadFollowupStatus;
  sequence: { id: string; slug: string; name: string } | null;
  queued_count: number;
  sent_count: number;
  total_steps: number | null;
  /** Epoch em segundos. */
  next_run_at: number | null;
  last_sent_at: number | null;
  /** Quais botões o servidor aceita agora. A tela NÃO deduz isso sozinha: botão
   *  que aparece e não faz nada é exatamente o que este bloco tinha. */
  can_pause: boolean;
  can_resume: boolean;
  can_stop: boolean;
  sequences: LeadFollowupSequenceOption[];
}

export interface LeadFollowupPayload {
  jobs: LeadFollowupJob[];
  state: LeadFollowupState;
}

/** Aceita contato OU conversa: lead de formulário/anúncio pode não ter conversa,
 *  e o follow-up é do LEAD. */
export interface LeadRef {
  contactId?: string | null;
  conversationId?: string | null;
}

const BASE = '/followup_jobs';

const IDLE_STATE: LeadFollowupState = {
  status: 'idle',
  sequence: null,
  queued_count: 0,
  sent_count: 0,
  total_steps: null,
  next_run_at: null,
  last_sent_at: null,
  can_pause: false,
  can_resume: false,
  can_stop: false,
  sequences: [],
};

const refParams = ({ contactId, conversationId }: LeadRef) =>
  contactId ? { contact_id: contactId } : { conversation_id: conversationId };

interface RawEnvelope {
  data?: unknown;
  meta?: Partial<LeadFollowupState>;
  message?: string;
}

const unwrap = (raw: RawEnvelope | undefined): LeadFollowupPayload => ({
  jobs: Array.isArray(raw?.data) ? (raw.data as LeadFollowupJob[]) : [],
  state: { ...IDLE_STATE, ...(raw?.meta ?? {}) },
});

/** As ações devolvem só o estado novo (`data`), sem a lista — a tela recarrega a
 *  linha do tempo em seguida, de uma fonte só. */
const unwrapState = (raw: RawEnvelope | undefined): { state: LeadFollowupState; message?: string } => ({
  state: { ...IDLE_STATE, ...((raw?.data as Partial<LeadFollowupState>) ?? {}) },
  message: raw?.message,
});

export const leadFollowupService = {
  async get(ref: LeadRef): Promise<LeadFollowupPayload> {
    const { data } = await api.get(BASE, { params: refParams(ref) });
    return unwrap(data);
  },

  async start(ref: LeadRef, sequenceSlug?: string) {
    const { data } = await api.post(`${BASE}/start`, {
      ...refParams(ref),
      sequence_slug: sequenceSlug,
    });
    return unwrapState(data);
  },

  async pause(ref: LeadRef) {
    const { data } = await api.post(`${BASE}/pause`, refParams(ref));
    return unwrapState(data);
  },

  async resume(ref: LeadRef) {
    const { data } = await api.post(`${BASE}/resume`, refParams(ref));
    return unwrapState(data);
  },

  async stop(ref: LeadRef) {
    const { data } = await api.post(`${BASE}/stop`, refParams(ref));
    return unwrapState(data);
  },
};

export { IDLE_STATE as EMPTY_LEAD_FOLLOWUP_STATE };

/** O status HTTP de um erro do cliente HTTP, sem `any` na tela. 403 tem que ser
 *  distinguível: engolir o erro e mostrar "sem passos agendados" foi o que fez a
 *  linha do tempo parecer vazia para quem só não tinha permissão. */
export const httpStatusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

/** A primeira mensagem de erro que o servidor mandou, quando mandou alguma. */
export const serverErrorOf = (error: unknown): string | undefined =>
  (error as { response?: { data?: { errors?: string[] } } } | undefined)
    ?.response?.data?.errors?.[0];
