// Types do módulo Funis de Mensagem — substitui Respostas Prontas + Respostas Rápidas.
// Backend: app/controllers/api/v1/message_funnels_controller.rb (evo-ai-crm-community)

// 'delay' = item de espera puro. Se `config.random_interval` for true, a espera
// sorteia entre `config.min_seconds`/`config.max_seconds` (mirror do bloco
// "intervalo" do Hub) em vez de usar `delay_seconds` fixo.
// 'contact' = cartão de contato (config.contact_name/contact_phone).
// 'sticker' = figurinha (mesmo limite de mídia da imagem, sem legenda).
export type FunnelItemKind = 'text' | 'audio' | 'image' | 'video' | 'document' | 'delay' | 'contact' | 'sticker';

export interface FunnelItemConfig {
  random_interval?: boolean;
  min_seconds?: number;
  max_seconds?: number;
  contact_name?: string;
  contact_phone?: string;
  [key: string]: unknown;
}

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
  config: FunnelItemConfig;
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
  folder_id: string | null;
  humanize: boolean;
  tag_ids: string[];
  items: MessageFunnelItem[];
  created_at: string;
  updated_at: string;
}

export interface MessageFunnelFolder {
  id: string;
  name: string;
  color: string;
  position: number;
  funnels_count: number;
  enabled_count: number;
}

export interface MessageFunnelTag {
  id: string;
  name: string;
  color: string;
  usage_count: number;
}

// Payload pra criar/editar (frontend → backend).
// `media_signed_id` é gerado por direct upload do ActiveStorage Rails (POST /rails/active_storage/direct_uploads).
export interface FunnelItemPayload {
  id?: string;               // id do item existente (edição) — backend faz upsert e PRESERVA a mídia já anexada; ausente = item novo
  position: number;
  kind: FunnelItemKind;
  text_content?: string | null;
  media_caption?: string | null;
  media_filename?: string | null;
  delay_seconds: number;
  config?: FunnelItemConfig;
  media_signed_id?: string;  // novo upload via direct upload
}

export interface FunnelPayload {
  name: string;
  description?: string | null;
  category?: string;
  active?: boolean;
  shared?: boolean;
  folder_id?: string | null;
  humanize?: boolean;
  tag_ids?: string[];
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
  /** true = criada sozinha a partir de um campo de formulário conectado ao CRM. */
  auto_created?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariablesResponse {
  builtin: TemplateVariable[];
  custom: TenantTemplateVariable[];
}
