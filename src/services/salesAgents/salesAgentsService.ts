import api from '@/services/core/api';

export type SalesAgentMode = 'seller' | 'sdr' | 'assistant';

export type ActiveHoursMode = 'always' | 'outside_business' | 'custom';
export interface ActiveHoursWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}
export interface ActiveHours {
  mode?: ActiveHoursMode;
  tz?: string;
  windows?: ActiveHoursWindow[];
}

export interface SalesAgent {
  id: string;
  name: string;
  enabled: boolean;
  mode: SalesAgentMode;
  trigger_keyword: string | null;
  persona_role: string | null;
  persona_goal: string | null;
  instructions: string | null;
  greeting: string | null;
  qualification_questions: string[];
  transfer_config: Record<string, unknown>;
  handoff_message: string | null;
  model: string;
  temperature: number;
  max_context_tokens: number;
  reply_delay_seconds: number;
  inbox_id: string | null;
  inbox_name: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  active_hours: ActiveHours;
  followup_enabled: boolean;
  followup_only: boolean;
  followup_min_days: number;
  followup_max_days: number;
  followup_max_attempts: number;
  documents_count: number;
  created_at: string;
  updated_at: string;
}

export interface SalesAgentPayload {
  name: string;
  enabled?: boolean;
  mode?: SalesAgentMode;
  trigger_keyword?: string | null;
  persona_role?: string | null;
  persona_goal?: string | null;
  instructions?: string | null;
  greeting?: string | null;
  qualification_questions?: string[];
  handoff_message?: string | null;
  temperature?: number;
  inbox_id?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  active_hours?: ActiveHours;
  followup_enabled?: boolean;
  followup_only?: boolean;
  followup_min_days?: number;
  followup_max_days?: number;
  followup_max_attempts?: number;
}

export interface SalesAgentDocument {
  id: string;
  sales_agent_id: string;
  title: string;
  source_type: 'file' | 'text' | 'url';
  source_url: string | null;
  char_count: number;
  tags: string[];
  status: 'pending' | 'ready' | 'failed';
  error_message: string | null;
  has_file: boolean;
  filename: string | null;
  preview: string;
  created_at: string;
  updated_at: string;
}

export interface SalesAgentTestResult {
  reply: string;
  temperature: 'hot' | 'warm' | 'cold' | 'unknown';
  should_transfer: boolean;
  transfer_reason: string | null;
  collected: Record<string, unknown>;
  lead_summary: string;
}

export interface TestHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface SalesAgentPropertyLink {
  link: string;
  message: string;
  number: string;
  property: { id: string; code: string; title: string } | null;
}

const BASE = '/sales_agents';

export const salesAgentsService = {
  async list(): Promise<SalesAgent[]> {
    const res = await api.get(BASE);
    return (res.data as { data: SalesAgent[] }).data ?? [];
  },

  async get(id: string): Promise<SalesAgent> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: SalesAgent }).data;
  },

  async create(payload: SalesAgentPayload): Promise<SalesAgent> {
    const res = await api.post(BASE, payload);
    return (res.data as { data: SalesAgent }).data;
  },

  async update(id: string, payload: Partial<SalesAgentPayload>): Promise<SalesAgent> {
    const res = await api.patch(`${BASE}/${id}`, payload);
    return (res.data as { data: SalesAgent }).data;
  },

  async destroy(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async testRun(
    id: string,
    message: string,
    history: TestHistoryItem[] = [],
    contactName?: string,
    propertyCode?: string,
  ): Promise<SalesAgentTestResult> {
    const res = await api.post(`${BASE}/${id}/test_run`, {
      message,
      history,
      contact_name: contactName,
      property_code: propertyCode || undefined,
    });
    return (res.data as { data: SalesAgentTestResult }).data;
  },

  // Gera o link wa.me pra colar no anúncio (código do imóvel + palavra-gatilho).
  async propertyLink(id: string, propertyCode?: string): Promise<SalesAgentPropertyLink> {
    const res = await api.get(`${BASE}/${id}/property_link`, {
      params: { property_code: propertyCode || undefined },
    });
    return (res.data as { data: SalesAgentPropertyLink }).data;
  },

  // --- base de conhecimento ---

  async listDocuments(agentId: string): Promise<SalesAgentDocument[]> {
    const res = await api.get(`${BASE}/${agentId}/documents`);
    return (res.data as { data: SalesAgentDocument[] }).data ?? [];
  },

  async createTextDocument(agentId: string, title: string, contentText: string): Promise<SalesAgentDocument> {
    const res = await api.post(`${BASE}/${agentId}/documents`, {
      source_type: 'text',
      title,
      content_text: contentText,
    });
    return (res.data as { data: SalesAgentDocument }).data;
  },

  async uploadFileDocument(agentId: string, file: File, title?: string): Promise<SalesAgentDocument> {
    const form = new FormData();
    form.append('source_type', 'file');
    form.append('file', file);
    if (title) form.append('title', title);
    const res = await api.post(`${BASE}/${agentId}/documents`, form);
    return (res.data as { data: SalesAgentDocument }).data;
  },

  async destroyDocument(agentId: string, docId: string): Promise<void> {
    await api.delete(`${BASE}/${agentId}/documents/${docId}`);
  },

  async reprocessDocument(agentId: string, docId: string): Promise<SalesAgentDocument> {
    const res = await api.post(`${BASE}/${agentId}/documents/${docId}/reprocess`);
    return (res.data as { data: SalesAgentDocument }).data;
  },
};

export default salesAgentsService;
