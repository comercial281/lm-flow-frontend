// Contrato da Sala de demonstração (GET /api/v1/demo_room). Nomes em snake_case
// exatamente como o servidor devolve.

export type DemoSessionStatus = 'waiting' | 'live' | 'ended';
export type FollowupStatus = 'enviado' | 'proximo' | 'depois';

export interface DemoRoomConfig {
  agent_id: string | null;
  agent_name: string | null;
  followup_flow_id: string | null;
  property_code: string | null;
  wa_number: string | null;
}

export interface DemoSession {
  id: string;
  code: string;
  lead_name: string;
  status: DemoSessionStatus;
  conversation_id: string | null;
  contact_id: string | null;
  started_at: string;
  wa_link: string;
}

export interface BackstageChecklistItem {
  pergunta: string;
  resposta: string | null;
  obrigatoria: boolean;
}

export interface BackstageHandoff {
  at: string;
  reason: string;
  summary: string;
}

export interface Backstage {
  stage_name: string | null;
  temperature: string | null;
  intent: string | null;
  caminho: string | null;
  checklist: BackstageChecklistItem[];
  collected: unknown;
  summary: string | null;
  qualified: boolean;
  handoff: BackstageHandoff | null;
}

export interface FollowupStep {
  step: number;
  kinds: string[];
  preview: string;
  real_delay: string;
  status: FollowupStatus;
}

export interface DemoRoomState {
  config: DemoRoomConfig;
  session: DemoSession | null;
  behind: Backstage | null;
  followup: FollowupStep[];
}

export interface PreflightItem {
  key: string;
  ok: boolean;
  label: string;
  fix: string | null;
}

export interface DemoRoomConfigInput {
  agent_id: string | null;
  followup_flow_id: string | null;
  property_code: string | null;
}
