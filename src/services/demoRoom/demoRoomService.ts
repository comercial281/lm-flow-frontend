import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type {
  DemoRoomConfigInput, DemoRoomState, DemoSession, PreflightItem,
} from '@/types/demoRoom';

function falha(e: unknown, padrao: string): Error {
  const err = e as { response?: { data?: { error?: { message?: string } } } } | null;
  return new Error(err?.response?.data?.error?.message || padrao);
}

// Sessão que não existe mais (encerrada em outra aba, Recomeçar de outra pessoa):
// o servidor responde 404 "Not found", que não diz nada pra quem está na call.
const ENCERRADA = 'Essa demonstração já foi encerrada. Recarregue a página.';

function falhaDaSessao(e: unknown, padrao: string): Error {
  const status = (e as { response?: { status?: number } } | null)?.response?.status;
  return status === 404 ? new Error(ENCERRADA) : falha(e, padrao);
}

// Preserva o erro original no GET: a tela distingue 403 (sem acesso) e 404 (fora do espaço de demonstração).
export const demoRoomService = {
  async get(): Promise<DemoRoomState> {
    const res = await api.get('/demo_room');
    return extractData<DemoRoomState>(res);
  },

  async saveConfig(config: DemoRoomConfigInput): Promise<void> {
    try {
      await api.patch('/demo_room/config', config);
    } catch (e) {
      throw falha(e, 'Não consegui salvar a configuração da Sala.');
    }
  },

  async preflight(voz: boolean): Promise<PreflightItem[]> {
    try {
      const res = await api.get('/demo_room/preflight', { params: voz ? { voz: 1 } : {} });
      return extractData<PreflightItem[]>(res);
    } catch (e) {
      throw falha(e, 'Não consegui conferir a Sala.');
    }
  },

  async start(leadName: string): Promise<DemoSession> {
    try {
      const res = await api.post('/demo_room/sessions', { lead_name: leadName });
      return extractData<DemoSession>(res);
    } catch (e) {
      throw falha(e, 'Não consegui começar a demonstração.');
    }
  },

  async followupNow(sessionId: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await api.post(`/demo_room/sessions/${sessionId}/followup_now`);
      return extractData<{ ok: boolean; message: string }>(res);
    } catch (e) {
      throw falhaDaSessao(e, 'Não consegui disparar o follow-up agora.');
    }
  },

  async reset(sessionId: string): Promise<void> {
    try {
      await api.post(`/demo_room/sessions/${sessionId}/reset`);
    } catch (e) {
      throw falhaDaSessao(e, 'Não consegui zerar a demonstração.');
    }
  },
};
