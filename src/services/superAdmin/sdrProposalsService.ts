import api from '@/services/core/api';

// Épicos C+D — propostas de lição do Cérebro SDR.
//   D (refine): aperfeiçoamento — descreve o ajuste, a IA propõe, você aprova.
//   C (curate): curadoria das conversas passadas, a IA propõe lições, você aprova.
// A IA depende de crédito Anthropic; o fluxo propor->aprovar é determinístico.

export interface SdrProposal {
  id: string;
  source: 'refine' | 'curation' | 'manual';
  scope: 'global' | 'individual';
  kind: 'rule' | 'good_example' | 'bad_example';
  content: string;
  context?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  tenant_slug?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

interface Env<T> { success: boolean; data: T; error?: string; code?: string }

export class AiUnavailableError extends Error {}

function unwrap<T>(res: { data: unknown }): T {
  return (res.data as Env<T>).data;
}

export const sdrProposalsService = {
  async list(status = 'pending'): Promise<SdrProposal[]> {
    const res = await api.get('/super/sdr_proposals', { params: { status } });
    return unwrap<SdrProposal[]>(res);
  },
  async createManual(input: { scope: string; kind: string; content: string; context?: string; tenant?: string; agent_id?: string }): Promise<SdrProposal> {
    const res = await api.post('/super/sdr_proposals', input);
    return unwrap<SdrProposal>(res);
  },
  async approve(id: string): Promise<SdrProposal> {
    const res = await api.post(`/super/sdr_proposals/${id}/approve`);
    return unwrap<SdrProposal>(res);
  },
  async reject(id: string): Promise<SdrProposal> {
    const res = await api.post(`/super/sdr_proposals/${id}/reject`);
    return unwrap<SdrProposal>(res);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/super/sdr_proposals/${id}`);
  },
  async refine(input: { message: string; scope: string; tenant?: string; agent_id?: string; kind?: string }): Promise<SdrProposal> {
    try {
      const res = await api.post('/super/sdr_proposals/refine', input);
      return unwrap<SdrProposal>(res);
    } catch (e) {
      throw mapAiError(e);
    }
  },
  async curate(input: { tenant?: string; agent_id?: string; global?: boolean; limit?: number }): Promise<SdrProposal[]> {
    try {
      const res = await api.post('/super/sdr_proposals/curate', input);
      return unwrap<SdrProposal[]>(res);
    } catch (e) {
      throw mapAiError(e);
    }
  },
};

function mapAiError(e: unknown): Error {
  const err = e as { response?: { data?: { code?: string; error?: string } } };
  if (err?.response?.data?.code === 'AI_UNAVAILABLE') {
    return new AiUnavailableError(err.response.data.error || 'IA indisponível (sem crédito).');
  }
  return new Error(err?.response?.data?.error || 'Falhou.');
}

export const KIND_LABELS: Record<SdrProposal['kind'], string> = {
  rule: 'Regra',
  good_example: 'Bom exemplo',
  bad_example: 'Mau exemplo',
};
