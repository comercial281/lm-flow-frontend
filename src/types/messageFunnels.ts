// Types do módulo Funis de Mensagem — substitui Respostas Prontas + Respostas Rápidas.
// Backend: app/controllers/api/v1/message_funnels_controller.rb (evo-ai-crm-community)

export type FunnelItemKind = 'text' | 'audio' | 'image' | 'video' | 'document';

export interface MessageFunnelItem {
  id: string;
  position: number;
  kind: FunnelItemKind;
  text_content: string | null;
  media_url: string | null;
  media_caption: string | null;
  media_filename: string | null;
  media_content_type: string | null;
  delay_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface MessageFunnel {
  id: string;
  name: string;
  description: string | null;
  category: string;
  active: boolean;
  user_id: string | null;
  shared: boolean;
  usage_count: number;
  items: MessageFunnelItem[];
  created_at: string;
  updated_at: string;
}

// Payload pra criar/editar (frontend → backend).
// `media_signed_id` é gerado por direct upload do ActiveStorage Rails (POST /rails/active_storage/direct_uploads).
export interface FunnelItemPayload {
  position: number;
  kind: FunnelItemKind;
  text_content?: string | null;
  media_caption?: string | null;
  media_filename?: string | null;
  delay_seconds: number;
  media_signed_id?: string;  // novo upload via direct upload
}

export interface FunnelPayload {
  name: string;
  description?: string | null;
  category?: string;
  active?: boolean;
  shared?: boolean;
  items: FunnelItemPayload[];
}

// Variáveis de template (built-in + custom por tenant).
export interface TemplateVariable {
  token: string;        // "nome", "telefone", "empreendimento_atual"
  placeholder: string;  // "{{nome}}", "{{telefone}}", "{{empreendimento_atual}}"
  label: string;
  description?: string;
  builtin?: boolean;
}

export interface TenantTemplateVariable extends TemplateVariable {
  id: string;
  value_source: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariablesResponse {
  builtin: TemplateVariable[];
  custom: TenantTemplateVariable[];
}
