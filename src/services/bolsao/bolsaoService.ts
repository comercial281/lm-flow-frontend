import api from '@/services/core/api';

// ⚠️ O contato vem MASCARADO do servidor até o lead ser puxado. Os campos
// phone_number/email só existem quando `revealed` é true — não tente exibir o
// número antes disso, porque ele simplesmente não chega aqui.
export interface BolsaoLead {
  id: string;
  batch_id: string;
  batch_name: string | null;
  is_test: boolean;
  name: string;
  city: string | null;
  interest: string | null;
  source_label: string | null;
  waiting_since: string;
  status: string;
  revealed: boolean;
  phone_masked?: string | null;
  email_masked?: string | null;
  phone_number?: string;
  email?: string | null;
  contact_id?: string | null;
  pipeline_item_id?: string | null;
}

export interface BolsaoQuota {
  limit: number;
  window_minutes: number;
  used: number;
  remaining: number;
  next_available_at: string;
}

export interface BolsaoSettings {
  claims_per_window: number | string | null;
  window_minutes: number | string | null;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  label: string | null;
}

export interface BolsaoBatch {
  id: string;
  name: string;
  source: 'planilha' | 'teste';
  is_test: boolean;
  // 'archived' é a saída definitiva da lista, e é SOFT: nada some do servidor.
  // Não existe apagar — ver archiveBatch.
  status: 'preview' | 'importing' | 'ready' | 'paused' | 'failed' | 'archived';
  file_name: string | null;
  uploaded_by: { id: string | null; name: string | null };
  mapping: Record<string, string>;
  settings: Partial<BolsaoSettings>;
  effective_settings: BolsaoSettings;
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  invalid_count: number;
  claimed_count: number;
  available_count: number;
  error_message: string | null;
  stalled: boolean;
  created_at: string;
  // Só no upload e no #show:
  headers?: string[];
  sample_rows?: string[][];
  summary?: BolsaoSummary;
  target_options?: string[];
}

export interface BolsaoSummary {
  total: number;
  pending: number;
  available: number;
  claimed: number;
  duplicates: number;
  invalid: number;
}

export interface BolsaoClaimResult {
  lead: BolsaoLead;
  contact_id: string | null;
  // Os DOIS são necessários pra abrir o card recém-criado: o endereço do card é
  // /pipelines/<funil>?card=<card>. Não existe conversation_id: o Bolsão cria
  // contato e card, nunca conversa.
  pipeline_id: string | null;
  pipeline_item_id: string | null;
  quota: BolsaoQuota;
}

export interface BolsaoClaimRow {
  id: string;
  lead_name: string | null;
  batch_id: string;
  batch_name: string | null;
  is_test: boolean;
  claimed_by: { id: string | null; name: string | null };
  claimed_at: string;
  contact_id: string | null;
  pipeline_item_id: string | null;
}

const LEADS = '/bolsao_leads';
const BATCHES = '/bolsao_batches';

type Envelope<T> = { data: T; meta?: Record<string, unknown> };

export const bolsaoService = {
  // ── Corretor ──────────────────────────────────────────────────────────────
  async list(params: { q?: string; batch_id?: string } = {}): Promise<{
    leads: BolsaoLead[];
    quota: BolsaoQuota | null;
    availableCount: number;
  }> {
    const res = await api.get(LEADS, { params });
    const body = res.data as Envelope<BolsaoLead[]>;
    const meta = (body.meta ?? {}) as { quota?: BolsaoQuota; available_count?: number };
    return {
      leads: body.data ?? [],
      quota: meta.quota ?? null,
      availableCount: meta.available_count ?? 0,
    };
  },

  async quota(): Promise<BolsaoQuota> {
    const res = await api.get(`${LEADS}/quota`);
    return (res.data as Envelope<BolsaoQuota>).data;
  },

  async claim(id: string): Promise<BolsaoClaimResult> {
    const res = await api.post(`${LEADS}/${id}/claim`);
    return (res.data as Envelope<BolsaoClaimResult>).data;
  },

  // ── Gestor ────────────────────────────────────────────────────────────────
  async listBatches(): Promise<BolsaoBatch[]> {
    const res = await api.get(BATCHES);
    return (res.data as Envelope<BolsaoBatch[]>).data ?? [];
  },

  async getBatch(id: string): Promise<BolsaoBatch> {
    const res = await api.get(`${BATCHES}/${id}`);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  // Passo 1 do assistente: manda a planilha e recebe o palpite de mapeamento.
  // Nada vira lead ainda.
  async upload(file: File, name?: string, onProgress?: (pct: number) => void): Promise<BolsaoBatch> {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);

    const res = await api.post(BATCHES, form, {
      onUploadProgress: e => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  // Passo 2: o gestor confirmou (ou corrigiu) o mapeamento.
  async confirm(
    id: string,
    mapping: Record<string, string>,
    settings?: Partial<BolsaoSettings>,
  ): Promise<BolsaoBatch> {
    const res = await api.post(`${BATCHES}/${id}/confirm`, { mapping, settings });
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  async updateBatch(id: string, payload: { name?: string; settings?: Partial<BolsaoSettings> }): Promise<BolsaoBatch> {
    const res = await api.patch(`${BATCHES}/${id}`, payload);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  async pause(id: string): Promise<BolsaoBatch> {
    const res = await api.post(`${BATCHES}/${id}/pause`);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  async resume(id: string): Promise<BolsaoBatch> {
    const res = await api.post(`${BATCHES}/${id}/resume`);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  // Arquivar é a ÚNICA saída da lista, e não apaga nada: apagar levava junto o
  // "quem pegou o quê", então o servidor recusava toda lista que já tivesse tido
  // retirada — quase todas — e a lixeira era decorativa.
  async archiveBatch(id: string): Promise<BolsaoBatch> {
    const res = await api.post(`${BATCHES}/${id}/archive`);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  // Volta PAUSADA, não ao ar — quem religa a torneira é o "Voltar ao ar".
  async unarchiveBatch(id: string): Promise<BolsaoBatch> {
    const res = await api.post(`${BATCHES}/${id}/unarchive`);
    return (res.data as Envelope<BolsaoBatch>).data;
  },

  async claims(params: { batch_id?: string; user_id?: string; include_test?: boolean } = {}): Promise<{
    rows: BolsaoClaimRow[];
    byUser: { user_id: string; name: string | null; count: number }[];
  }> {
    const res = await api.get(`${BATCHES}/claims`, { params });
    const body = res.data as Envelope<BolsaoClaimRow[]>;
    const meta = (body.meta ?? {}) as { by_user?: { user_id: string; name: string | null; count: number }[] };
    return { rows: body.data ?? [], byUser: meta.by_user ?? [] };
  },

  async getRules(): Promise<BolsaoSettings & { limits: Record<string, number> }> {
    const res = await api.get(`${BATCHES}/rules`);
    return (res.data as Envelope<BolsaoSettings & { limits: Record<string, number> }>).data;
  },

  async saveRules(rules: Partial<BolsaoSettings>): Promise<BolsaoSettings> {
    const res = await api.patch(`${BATCHES}/rules`, { rules });
    return (res.data as Envelope<BolsaoSettings>).data;
  },

  // ── Lead de teste ─────────────────────────────────────────────────────────
  async createTestLead(payload: {
    phone_number: string;
    name?: string;
    email?: string;
    city?: string;
    interest?: string;
  }): Promise<{ id: string; batch: BolsaoBatch }> {
    const res = await api.post(`${BATCHES}/test_lead`, payload);
    return (res.data as Envelope<{ id: string; batch: BolsaoBatch }>).data;
  },

  async cleanupTestLeads(): Promise<{ removed: number; archived: number }> {
    const res = await api.delete(`${BATCHES}/test_leads`);
    return (res.data as Envelope<{ removed: number; archived: number }>).data;
  },
};

export default bolsaoService;
