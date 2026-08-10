import api from '@/services/core/api';

// Config de roteamento de um formulário Lead Ads (Meta) -> destino no CRM.
export interface LeadAdsFormConfig {
  id: string;
  form_id: string;
  form_name: string;
  // De qual PÁGINA do Facebook é o formulário. Nulo = vale pra qualquer página
  // (comportamento de quando só existia uma conexão).
  meta_page_id: string | null;
  page_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  label_ids: string[];
  // Roteamento de entrada: responsável fixo OU roleta + imóvel vinculado.
  default_assignee_id: string | null;
  roleta_config_id: string | null;
  property_id: string | null;
  match_keyword: string | null;
  // Mensagem inicial disparada pelo número de plantão quando o lead chega FORA
  // do horário da roleta. Vazio = não manda nada (o comportamento de sempre).
  after_hours_message: string | null;
  is_active: boolean;
  created_at: string;
}

// Formulário vindo do Facebook (GET meta_forms). `id` = form_id.
// page_id/page_name/meta_page_id dizem de qual página conectada ele veio — a
// listagem agora agrega todas as páginas.
export interface MetaForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  page_id?: string;
  page_name?: string;
  meta_page_id?: string | null;
}

// Payload de create/update (sempre dentro de lead_ads_form_config).
export interface LeadAdsFormConfigFormData {
  form_id: string;
  form_name: string;
  meta_page_id?: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  is_active: boolean;
  label_ids: string[];
  default_assignee_id?: string | null;
  roleta_config_id?: string | null;
  property_id?: string | null;
  match_keyword?: string | null;
  after_hours_message?: string | null;
}

// Erro de UMA página na listagem de formulários. Antes havia só um `error` no
// topo e uma página com token ruim escondia os formulários de todas as outras.
export interface MetaFormsPageError {
  page_id?: string;
  page_name?: string;
  meta_page_id?: string | null;
  error: string;
}

// Resposta de meta_forms — pode vir { data, errors } se alguma página falhar.
export interface MetaFormsResult {
  data: MetaForm[];
  errors: MetaFormsPageError[];
  error?: string;
}

// Diagnóstico do token da Meta conectado (super-admin). Mostra app/permissões/
// página e o próprio token salvo (a UI normal esconde), sem o usuário manuseá-lo.
export interface MetaTokenDebug {
  meta_page_id?: string | null;
  app_id?: string;
  app_name?: string;
  token_type?: string;            // PAGE | USER | SYSTEM_USER...
  is_valid?: boolean;
  expires_at?: number;            // 0 = nunca expira (permanente)
  data_access_expires_at?: number;
  scopes: string[];
  missing_scopes: string[];       // das exigidas p/ Lead Ads que faltam
  token_error?: string;           // motivo se o Facebook recusou o token (190 etc.)
  token_length?: number;          // tamanho do token salvo (pega truncamento/espaço)
  page_token_ok?: boolean;        // conseguiu derivar o token de página? (sinal real do bug)
  page_token_error?: string;      // o que fazer se não conseguiu (atribuir página ao System User)
  webhook_subscribed?: boolean;   // página inscrita no app p/ leadgen? (recebimento em tempo real)
  webhook_error?: string;         // o que fazer se não está inscrita
  webhook_callback_url?: string;  // URL exata pra colar no App Meta → Webhooks
  webhook_verify_token?: string;  // verify token REAL que o endpoint valida (não o FB_VERIFY_TOKEN)
  page_id?: string;
  page_ok?: boolean;              // o token enxerga a página configurada?
  page_name?: string;
  page_error?: string;
  access_token?: string;
  // Diagnóstico de roteamento (linguagem simples): dos últimos leads recebidos,
  // quantos entraram sem etiqueta e de quais formulários (pelo nome).
  routing_ok?: boolean;
  total_recent_leads?: number;
  unmatched_leads?: number;
  matched_forms_count?: number;
  unmatched_forms?: { name: string; lead_count: number }[];
}

export interface MetaTokenDebugResult {
  data: MetaTokenDebug;
  pages: MetaTokenDebug[];
}

const BASE = '/lead_ads_form_configs';

export const leadAdsFormsService = {
  async getAll(): Promise<LeadAdsFormConfig[]> {
    const res = await api.get(BASE);
    return (res.data as { data: LeadAdsFormConfig[] }).data ?? [];
  },

  async create(data: LeadAdsFormConfigFormData): Promise<LeadAdsFormConfig> {
    const res = await api.post(BASE, { lead_ads_form_config: data });
    return (res.data as { data: LeadAdsFormConfig }).data;
  },

  async update(id: string, data: LeadAdsFormConfigFormData): Promise<LeadAdsFormConfig> {
    const res = await api.patch(`${BASE}/${id}`, { lead_ads_form_config: data });
    return (res.data as { data: LeadAdsFormConfig }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async syncMetaForms(): Promise<MetaFormsResult> {
    const res = await api.get(`${BASE}/meta_forms`);
    const body = res.data as { data?: MetaForm[]; errors?: MetaFormsPageError[]; error?: string };
    return { data: body.data ?? [], errors: body.errors ?? [], error: body.error };
  },

  // Diagnostica o token da Meta conectado (super-admin). Lança em erro/403.
  // Sem pageId diagnostica TODAS as páginas conectadas (`pages`); `data` continua
  // trazendo a primeira, mantendo o contrato antigo.
  async debugMetaToken(pageId?: string): Promise<MetaTokenDebugResult> {
    const res = await api.get(`${BASE}/meta_token_debug`, pageId ? { params: { page_id: pageId } } : undefined);
    const body = res.data as { data: MetaTokenDebug; pages?: MetaTokenDebug[] };
    return { data: body.data, pages: body.pages ?? (body.data ? [body.data] : []) };
  },

  // Inscreve (ou reinscreve) a página no app p/ leadgen — ativa o recebimento em
  // tempo real dos leads. Super-admin. Lança em erro/403.
  async subscribeWebhook(pageId?: string): Promise<{ webhook_subscribed: boolean }> {
    const res = await api.post(`${BASE}/subscribe_webhook`, pageId ? { page_id: pageId } : {});
    return (res.data as { data: { webhook_subscribed: boolean } }).data;
  },

  // Importa retroativamente os leads dos últimos N dias que ainda não entraram.
  // dryRun=true só conta (não cria). Idempotente por telefone.
  async backfill(sinceDays: number, dryRun: boolean): Promise<BackfillResult> {
    const res = await api.post(`${BASE}/backfill`, { since_days: sinceDays, dry_run: dryRun });
    return (res.data as { data: BackfillResult }).data;
  },

  // Limpeza (super-admin) das etiquetas de imóvel criadas pela derivação automática
  // (revertida). confirm=false só lista; confirm=true apaga. Roda no tenant atual.
  async cleanupFormLabels(confirm: boolean): Promise<CleanupFormLabelsResult> {
    const res = await api.post(`${BASE}/cleanup_form_labels`, { confirm });
    return (res.data as { data: CleanupFormLabelsResult }).data;
  },
};

export interface CleanupFormLabelsResult {
  count: number;
  labels: { id: string; title: string }[];
  deleted: boolean;
}

export interface BackfillResult {
  since_days: number;
  dry_run: boolean;
  total_leads: number;
  ja_no_crm: number;
  faltavam: number;
  importados: number;
  por_formulario: { form: string; total: number; existing: number; missing: number }[];
}
