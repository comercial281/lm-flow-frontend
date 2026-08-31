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
  /** Coluna pra onde o card volta quando o lead responde. Vazio = fica onde está. */
  reply_stage_slug?: string | null;
  /** Exemplo da etiqueta que o funil vai aplicar, vindo do backend. */
  progress_tag_sample?: string | null;
  steps_count: number;
  /** Quantos disparos este funil já tem. A confirmação de excluir mostra o número,
   *  porque apagar o funil apaga o histórico junto. */
  jobs_count: number;
  /** Quantas portas de entrada o funil tem. Zero = só roda quando alguém mandar
   *  pelo card; a lista avisa, senão parece que o funil está quebrado. */
  entries_count: number;
  steps: FollowupStep[];
  created_at: string;
  updated_at: string;
}

/** Os gatilhos que a tela oferece. O motor entende 16 — o resto não cabe na cabeça
 *  de quem está montando um funil e nunca foi pedido.
 *
 *  Não há disparo por "lead não respondeu": ele saiu em 2026-08-13, até o fluxo por
 *  coluna estar validado. A lista real vem do backend; este tipo só acompanha. */
export type FollowupEntryKind =
  | 'stage'
  | 'label'
  | 'new_lead'
  | 'visit_scheduled'
  | 'visit_completed';

/** Uma porta de entrada do funil: o que faz ELE começar. */
export interface FollowupEntry {
  id: number;
  kind: FollowupEntryKind;
  label: string;
  enabled: boolean;
  stage_id?: string | null;
  tag?: string | null;
  paid_only: boolean;
}

export interface FollowupEntryKindOption {
  value: FollowupEntryKind;
  label: string;
  /** Qual detalhe a tela precisa pedir junto (null = nenhum). */
  needs: 'stage_id' | 'label' | 'paid_only' | null;
}

export interface FollowupEntryStage {
  id: string;
  name: string;
  pipeline_id: string;
  pipeline_name: string;
}

/** Tudo que o formulário de entrada precisa, numa chamada só. */
export interface FollowupEntriesPayload {
  entries: FollowupEntry[];
  kinds: FollowupEntryKindOption[];
  stages: FollowupEntryStage[];
  labels: string[];
}

export interface FollowupEntryFormData {
  id?: number;
  kind: FollowupEntryKind;
  enabled?: boolean;
  stage_id?: string;
  label?: string;
  paid_only?: boolean;
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
  reply_stage_slug?: string | null;
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

/** O que vem dentro de um arquivo de funil exportado. A tela lê o arquivo antes
 *  de mandar pro servidor pra mostrar a prévia — importar às cegas o que veio de
 *  outro cliente é o mesmo problema que "escolher modelo sem ver o texto". */
export interface FollowupPackage {
  format: string;
  version: number;
  exported_at?: string;
  exported_from?: string | null;
  warnings?: string[];
  sequence: {
    name: string;
    slug?: string;
    description?: string | null;
    steps: { message_type: FollowupMessageType; media?: unknown }[];
    entries?: unknown[];
  };
}

/** O resumo que a janela de confirmação mostra. Montado no navegador a partir do
 *  arquivo — o servidor devolve o mesmo depois, mas aí já teria importado. */
export interface FollowupPackageSummary {
  name: string;
  exportedFrom: string | null;
  stepsCount: number;
  mediaCount: number;
  entriesCount: number;
  warnings: string[];
}

export interface FollowupImportResult {
  sequence: FollowupSequence;
  /** O que não deu pra trazer pra este cliente: coluna que não existe aqui,
   *  mídia que não pôde ser baixada, entrada não recriada. Nunca fica em
   *  silêncio — é a lista que a tela mostra depois de importar. */
  pendencias: string[];
}

/** Formato aceito pelo importador. Fica aqui (e não solto na tela) porque o
 *  servidor recusa qualquer outro: os dois lados precisam dizer a mesma coisa. */
export const FOLLOWUP_PACKAGE_FORMAT = 'lm_flow.followup_package';

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

  // --- Entradas do funil ("Quando este funil começa") ---

  async getEntries(id: string): Promise<FollowupEntriesPayload> {
    const res = await api.get(`${BASE}/${id}/entries`);
    return (res.data as { data: FollowupEntriesPayload }).data;
  },

  /** Cria ou atualiza — o backend decide pelo `id`, e a tela usa o mesmo
   *  formulário nos dois casos. */
  async saveEntry(id: string, entry: FollowupEntryFormData): Promise<FollowupEntry> {
    const res = await api.post(`${BASE}/${id}/entries`, { entry });
    return (res.data as { data: FollowupEntry }).data;
  },

  async deleteEntry(id: string, entryId: number): Promise<void> {
    await api.delete(`${BASE}/${id}/entries/${entryId}`);
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

  /** Baixa o funil como arquivo, com a mídia dentro. É o arquivo que se importa
   *  nos outros clientes — ver o porquê de a mídia ir junto no serviço do
   *  servidor (endereço de mídia de um cliente não abre no outro). */
  async exportToFile(seq: Pick<FollowupSequence, 'id' | 'slug' | 'name'>): Promise<void> {
    const res = await api.get(`${BASE}/${seq.id}/export`, { responseType: 'blob' });

    // O servidor manda o nome no cabeçalho; quando o navegador não o expõe
    // (CORS sem expose-headers), o nome derivado daqui é o mesmo.
    const header = String(res.headers?.['content-disposition'] ?? '');
    const fromHeader = /filename="?([^";]+)"?/.exec(header)?.[1];
    const filename = fromHeader || `funil-${seq.slug || 'follow-up'}.lmflow.json`;

    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /** Cria o funil deste cliente a partir do arquivo. Ele chega DESLIGADO — quem
   *  liga é uma pessoa, depois de ler as mensagens. */
  async importFromFile(file: File): Promise<FollowupImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`${BASE}/import`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as { data: FollowupImportResult }).data;
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

/** Lê o conteúdo do arquivo escolhido.
 *
 *  Usa `FileReader` e não `File.text()`: o segundo não existe em todo ambiente
 *  (nem no que roda os testes), e a falha dele é indistinguível de "arquivo
 *  corrompido" — o que mandaria a pessoa procurar problema no arquivo certo. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Lê o arquivo escolhido e devolve o funil junto com o resumo, ou a mensagem do
 *  que está errado com ele. Roda no navegador de propósito: a pessoa vê o que vai
 *  entrar ANTES de qualquer coisa ser criada no CRM. O servidor valida de novo —
 *  esta é a cortesia, não a barreira. */
export async function readFollowupPackage(
  file: File,
): Promise<
  | { pkg: FollowupPackage; summary: FollowupPackageSummary; error: null }
  | { pkg: null; summary: null; error: string }
> {
  let parsed: FollowupPackage;
  try {
    parsed = JSON.parse(await readFileText(file)) as FollowupPackage;
  } catch {
    return { pkg: null, summary: null, error: 'Não deu pra ler o arquivo — ele parece estar corrompido.' };
  }

  if (!parsed || parsed.format !== FOLLOWUP_PACKAGE_FORMAT) {
    return { pkg: null, summary: null, error: 'Este arquivo não é um funil de follow-up exportado do LM Flow.' };
  }

  const steps = Array.isArray(parsed.sequence?.steps) ? parsed.sequence.steps : [];
  if (steps.length === 0) {
    return { pkg: null, summary: null, error: 'O funil deste arquivo não tem nenhuma mensagem.' };
  }

  return {
    pkg: parsed,
    error: null,
    summary: {
      name: parsed.sequence.name,
      exportedFrom: parsed.exported_from ?? null,
      stepsCount: steps.length,
      mediaCount: steps.filter(s => !!s.media).length,
      entriesCount: Array.isArray(parsed.sequence.entries) ? parsed.sequence.entries.length : 0,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    },
  };
}
