import api from '@/services/core/api';

// Cérebro Universal SDR (Épico A): base de conhecimento + lições GLOBAIS (schema
// public) injetadas no prompt de todo agente de todos os tenants. Gerenciado no
// painel raiz (Área do Admin). Backend: /api/v1/super/global_*.

export interface GlobalKnowledgeDoc {
  id: string;
  title: string;
  source_type: 'text' | 'url' | 'file';
  status: 'pending' | 'ready' | 'failed';
  category?: string | null;
  enabled: boolean;
  char_count: number;
  content_text?: string | null;
  error_message?: string | null;
  has_file: boolean;
  filename?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalLesson {
  id: string;
  kind: 'rule' | 'good_example' | 'bad_example';
  content: string;
  context?: string | null;
  category?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const globalBrainService = {
  // ---- Conhecimento ----
  async listDocs(): Promise<GlobalKnowledgeDoc[]> {
    const res = await api.get('/super/global_knowledge_documents');
    return (res.data as Envelope<GlobalKnowledgeDoc[]>).data;
  },

  async createTextDoc(input: { title: string; content_text: string; category?: string }): Promise<GlobalKnowledgeDoc> {
    const res = await api.post('/super/global_knowledge_documents', { ...input, source_type: 'text' });
    return (res.data as Envelope<GlobalKnowledgeDoc>).data;
  },

  async createFileDoc(input: { title: string; category?: string; file: File }): Promise<GlobalKnowledgeDoc> {
    const fd = new FormData();
    fd.append('title', input.title);
    fd.append('source_type', 'file');
    if (input.category) fd.append('category', input.category);
    fd.append('file', input.file);
    const res = await api.post('/super/global_knowledge_documents', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as Envelope<GlobalKnowledgeDoc>).data;
  },

  async updateDoc(id: string, patch: Partial<Pick<GlobalKnowledgeDoc, 'title' | 'category' | 'enabled' | 'content_text'>>): Promise<GlobalKnowledgeDoc> {
    const res = await api.put(`/super/global_knowledge_documents/${id}`, patch);
    return (res.data as Envelope<GlobalKnowledgeDoc>).data;
  },

  async deleteDoc(id: string): Promise<void> {
    await api.delete(`/super/global_knowledge_documents/${id}`);
  },

  // ---- Lições ----
  async listLessons(): Promise<GlobalLesson[]> {
    const res = await api.get('/super/global_sales_lessons');
    return (res.data as Envelope<GlobalLesson[]>).data;
  },

  async createLesson(input: { kind: GlobalLesson['kind']; content: string; context?: string; category?: string }): Promise<GlobalLesson> {
    const res = await api.post('/super/global_sales_lessons', input);
    return (res.data as Envelope<GlobalLesson>).data;
  },

  async updateLesson(id: string, patch: Partial<Pick<GlobalLesson, 'content' | 'context' | 'category' | 'enabled'>>): Promise<GlobalLesson> {
    const res = await api.put(`/super/global_sales_lessons/${id}`, patch);
    return (res.data as Envelope<GlobalLesson>).data;
  },

  async deleteLesson(id: string): Promise<void> {
    await api.delete(`/super/global_sales_lessons/${id}`);
  },
};

export const KIND_LABELS: Record<GlobalLesson['kind'], string> = {
  rule: 'Regra',
  good_example: 'Bom exemplo',
  bad_example: 'Mau exemplo',
};

/**
 * Um PRINCÍPIO do comando da IA — as regras que valem em toda imobiliária (não
 * recomeçar a conversa, não prometer material que não existe, o jeito de escrever
 * no WhatsApp, a triagem do contato).
 *
 * Endereçados pela CHAVE, não por id: a linha só nasce quando alguém edita, e a
 * tela precisa falar dos blocos desde o primeiro acesso — inclusive dos que ainda
 * estão no padrão de fábrica.
 */
export interface PlaybookPrinciple {
  key: string;
  label: string;
  /** Texto em uso, COM os encaixes ({situacao}, {lista_objecoes}...). */
  content: string;
  factory_default: string;
  customized: boolean;
  enabled: boolean;
  updated_at: string | null;
  /** O que este bloco aceita entre chaves; marcador fora da lista é recusado. */
  allowed_markers: string[];
  /** `flow` = roteiro de venda (o alicerce); `principle` = regra da casa. */
  kind: 'flow' | 'principle';
}

const PRINCIPLES_BASE = '/super/ai_playbook_blocks';

export const playbookPrinciplesService = {
  async list(): Promise<PlaybookPrinciple[]> {
    const res = await api.get(PRINCIPLES_BASE);
    return (res.data as { data: PlaybookPrinciple[] }).data;
  },

  // Conteúdo em BRANCO devolve o bloco ao padrão de fábrica — é o "voltar ao
  // padrão", e é o mesmo significado que vazio tem em toda a plataforma: herda,
  // nunca "desliga".
  async update(key: string, content: string): Promise<PlaybookPrinciple> {
    const res = await api.patch(`${PRINCIPLES_BASE}/${key}`, { content });
    return (res.data as { data: PlaybookPrinciple }).data;
  },
};
