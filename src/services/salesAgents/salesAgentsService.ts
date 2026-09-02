import api from '@/services/core/api';
import type { AgentPerformance } from '@/types/aiResults';

export type SalesAgentMode = 'seller' | 'sdr' | 'assistant';

export type ActiveHoursMode = 'always' | 'outside_business' | 'custom';
export interface ActiveHoursWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  /**
   * Dias da semana em que ESTA janela vale (0=domingo … 6=sábado).
   * Ausente ou vazio = todos os dias.
   *
   * O campo existia no banco havia meses e não fazia nada: o backend descartava
   * o array no strong params e o gate de horário nem lia. Agora vale de verdade
   * — janela que atravessa a meia-noite conta pelo dia de INÍCIO.
   */
  days?: number[];
}
export interface ActiveHours {
  mode?: ActiveHoursMode;
  tz?: string;
  windows?: ActiveHoursWindow[];
}

export type SalesAgentTriggerType = 'keyword' | 'origin' | 'property' | 'pipeline_stage' | 'pipeline' | 'tag';
/** any = QUALQUER gatilho da lista ativa (padrão/OR). all = TODOS precisam bater (AND). */
export type SalesAgentTriggerMatchMode = 'any' | 'all';
export interface SalesAgentTrigger {
  type: SalesAgentTriggerType;
  value?: string;        // keyword: a palavra ; tag: nome da etiqueta
  mode?: string;         // origin: 'all' | 'ads' ; property: 'any' | 'code'
  code?: string;         // property: código do imóvel
  pipeline_id?: string;  // pipeline_stage
  stage_id?: string;     // pipeline_stage
  match_type?: 'contains' | 'equals'; // keyword: contém a palavra ou é exatamente ela
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
  transfer_config: TransferConfig;
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
  triggers: SalesAgentTrigger[];
  trigger_match_mode: SalesAgentTriggerMatchMode;
  bant_config: BantConfig;
  usage_limits: UsageLimits;
  followup_enabled: boolean;
  followup_only: boolean;
  followup_min_days: number;
  followup_max_days: number;
  followup_max_attempts: number;
  /** O que a IA faz quando o lead some. 'ai' = ela escreve a mensagem (o único
   *  caminho que consome IA); 'pipeline' = move o card pra coluna do silêncio e
   *  quem manda a mensagem é o funil que aquela coluna dispara; 'sequence' =
   *  dispara o funil escolhido direto, sem mexer no card. */
  followup_action: SalesAgentFollowupAction;
  followup_stage_id: string | null;
  /** Coluna de volta quando o lead responde. Vazia = a primeira coluna do funil. */
  followup_return_stage_id: string | null;
  followup_sequence_slug: string | null;
  /** Gotejamento: a IA entrega um punhado de leads por vez, com pausa sorteada
   *  entre um punhado e o próximo. Sem ele saem até 200 de uma vez, e o funil
   *  despeja até 100 mensagens a cada 5 min — é assim que um número é derrubado. */
  followup_drip_enabled: boolean;
  followup_drip_min_leads: number;
  followup_drip_max_leads: number;
  followup_drip_min_minutes: number;
  followup_drip_max_minutes: number;
  audio_enabled: boolean;
  audio_mode: 'mirror' | 'always' | 'never';
  audio_voice_id: string | null;
  sales_method: SalesMethod;
  social_proof: string | null;
  booking_enabled: boolean;
  visit_duration_minutes: number;
  example_conversations: SalesAgentExample[];
  locacao_enabled: boolean;
  escalate_on_frustration: boolean;
  escalate_on_human_request: boolean;
  escalate_on_ai_detected: boolean;
  ai_limits: AiLimits;
  crm_policy: CrmPolicy;
  ask_google_review: boolean;
  google_review_link: string | null;
  cross_sell_enabled: boolean;
  rich_media_enabled: boolean;
  visit_config: VisitConfig;
  default_property_code: string | null;
  default_origin: string | null;
  intent_question: string | null;
  opening_image_url: string | null;
  opening_audio_url: string | null;
  openings: SalesAgentOpening[];
  /** Desempate quando o mesmo canal tem mais de um agente (maior ganha). */
  priority: number;
  /** Follow-up respeita TAMBÉM o horário de atuação, além da janela diurna fixa. */
  /**
   * O horário PRÓPRIO do follow-up: quando a IA pode ir atrás de quem sumiu.
   * Mesmo formato do `active_hours`, e `mode` é sempre 'custom'.
   *
   * ⚠️ Vem sempre RESOLVIDO do servidor — vazio no banco significa o padrão de
   * fábrica (09h às 17h, seg a sáb), nunca 24 horas.
   *
   * Substituiu a chave "Seguir também o horário de atuação", que era
   * write-only-true: o servidor nunca a devolvia, então marcar gravava e
   * recarregar mostrava desmarcado, sem caminho de volta.
   */
  followup_hours: ActiveHours;
  /** Avisar o lead que estamos fora do horário (uma vez por conversa por dia). */
  out_of_hours_reply: boolean;
  out_of_hours_message: string | null;
  /** Deixa a IA consultar o catálogo real de imóveis pra oferecer alternativa. */
  catalog_search_enabled: boolean;
  /**
   * A IA responde em VÁRIAS mensagens curtas, com "digitando..." entre elas, em vez
   * de um parágrafo único. Quem quebra é a própria IA; o servidor tem uma regra
   * automática de segurança pra quando ela mandar um bloco grande.
   */
  message_split_enabled: boolean;
  /** Teto de mensagens por resposta. É teto, não meta: resposta curta sai numa só. */
  message_split_max_parts: number;
  /**
   * A IA move o card do lead no funil conforme a conversa anda, e o movimento fica
   * assinado por ela no histórico do card. Nasce DESLIGADA em todo cliente.
   */
  pipeline_move_enabled?: boolean;
  /**
   * Mapa "etapa da IA -> coluna do funil": { agendado: '<id da coluna>' }.
   * Etapa AUSENTE = a IA não mexe no card naquela etapa. O servidor devolve o mapa
   * já limpo (só etapas que existem, só colunas preenchidas).
   */
  pipeline_stage_map?: Record<string, string>;
  /**
   * A IA pode mandar sozinha o book que já está cadastrado no imóvel — sem precisar
   * subir o mesmo PDF de novo na aba de arquivos, e valendo pros imóveis futuros.
   */
  send_property_book_enabled?: boolean;
  /** Regra escrita uma vez, valendo pro book de QUALQUER imóvel. */
  book_send_rule?: string | null;
  /**
   * A IA pode CURTIR mensagens do lead — a reação com emoji que aparece grudada
   * na mensagem, no aparelho dele. Nasce desligada em todo cliente.
   */
  reaction_enabled?: boolean;
  /** Os únicos emojis que ela pode usar. O servidor devolve a lista já resolvida. */
  reaction_emojis?: string[];
  /** Teto de curtidas por conversa. */
  reaction_max_per_conversation?: number | null;
  documents_count: number;
  created_at: string;
  updated_at: string;
}

/** Um item do checklist de "essa IA está mesmo no ar?". */
export interface HealthItem {
  key: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface HealthReport {
  status: 'ok' | 'warning' | 'error';
  items: HealthItem[];
}

/** Um turno da IA: respondeu, pulou (com motivo) ou falhou (com o erro real). */
export interface SalesAgentRun {
  id: string;
  kind: 'live' | 'followup' | 'engage' | 'test';
  status: 'replied' | 'skipped' | 'failed';
  delivered: boolean;
  skip_reason: string | null;
  reason_label: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  conversation_id: string | null;
  created_at: string;
}

export interface SalesAgentRunTotals {
  runs: number;
  replied: number;
  skipped: number;
  failed: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

/** Prova de que as camadas de conhecimento chegaram ao prompt, sem gastar crédito. */
export interface PromptPreview {
  prompt: string;
  length: number;
  has_global_knowledge: boolean;
  has_client_knowledge: boolean;
  has_lessons: boolean;
  /** A lista de arquivos que ela pode mandar chegou no cérebro dela. */
  has_sendable_files?: boolean;
}

// Recepção inicial por CAMPANHA: a IA escolhe a que casa com a origem/form/palavra
// -chave do lead; senão usa o padrão do agente. Espelha a automação AUT (texto ->
// print -> áudio -> pergunta de intenção).
export interface SalesAgentOpening {
  label?: string;
  origins?: string[];   // casa se a origem do lead (campanha/anúncio/plataforma) contém algum
  form_ids?: string[];  // casa pelo ID do formulário do Meta
  keywords?: string[];  // casa se a 1ª mensagem do lead contém alguma
  greeting?: string;
  intent_question?: string;
  image_url?: string;
  audio_url?: string;
}

export type SalesMethod = 'consultative' | 'spin' | 'direct';

export interface SalesAgentExample {
  lead: string;
  resposta: string;
}

export interface AiLimits {
  address?: boolean;
  discount?: boolean;
  price?: boolean;
  iptu?: boolean;
  custom?: string[];
}

export interface CrmPolicy {
  cold?: boolean;
  capture?: boolean;
  invalid?: boolean;
}

/**
 * O cenário de repasse: quando a IA entrega o lead a um corretor.
 *
 * `mode` ausente = "como está hoje", e é o que vale em toda imobiliária que já existe:
 * cenário novo não muda o comportamento de quem nunca escolheu nada. `min_temperature`
 * só é lido no cenário da temperatura.
 */
export type SalesAgentFollowupAction = 'ai' | 'pipeline' | 'sequence';

export type HandoffMode = 'duvida' | 'temperatura' | 'sem_resposta' | 'pos_visita';

export interface TransferConfig {
  mode?: HandoffMode;
  min_temperature?: 'hot' | 'warm';
}

export interface VisitConfig {
  days?: number[]; // 0=dom .. 6=sáb
  start?: string;
  end?: string;
  min_advance_hours?: number;
  max_advance_days?: number;
  /** Datas específicas (YYYY-MM-DD) que a IA NUNCA pode oferecer — feriado, plantão fechado, manutenção. */
  blocked_dates?: string[];
  /** Antes de marcar, checa se já existe outra visita no mesmo imóvel no mesmo horário (padrão: sim). */
  avoid_double_booking?: boolean;
}

export interface BantConfig {
  enabled?: boolean;
  budget_question?: string;
  authority_question?: string;
  need_question?: string;
  timeline_question?: string;
  /** Texto livre: a IA decide "qualificado" com base nisto (sem critério = nunca decide sozinha). */
  qualify_criteria?: string;
}

export interface UsageLimits {
  /** Teto de leads NOVOS que a IA começa a atender por dia. Conversa já em andamento nunca é cortada. */
  max_new_leads_per_day?: number | null;
  /** Teto de conversas ativas ao mesmo tempo. */
  max_active_conversations?: number | null;
  /** Teto de gasto em dólar por dia (mesma métrica da aba Resultados). */
  daily_budget_usd?: number | null;
}

// Config gerada pelo formulário (o dono responde perguntas e o Claude monta).
export interface GeneratedAgentConfig {
  persona_role: string;
  persona_goal: string;
  instructions: string;
  greeting: string;
  social_proof: string | null;
  sales_method: SalesMethod;
  qualification_questions: string[];
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
  model?: string;
  temperature?: number;
  max_context_tokens?: number;
  reply_delay_seconds?: number;
  inbox_id?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  active_hours?: ActiveHours;
  triggers?: SalesAgentTrigger[];
  trigger_match_mode?: SalesAgentTriggerMatchMode;
  bant_config?: BantConfig;
  usage_limits?: UsageLimits;
  followup_enabled?: boolean;
  followup_only?: boolean;
  followup_min_days?: number;
  followup_max_days?: number;
  followup_max_attempts?: number;
  followup_action?: SalesAgentFollowupAction;
  followup_stage_id?: string | null;
  followup_return_stage_id?: string | null;
  followup_sequence_slug?: string | null;
  followup_drip_enabled?: boolean;
  followup_drip_min_leads?: number;
  followup_drip_max_leads?: number;
  followup_drip_min_minutes?: number;
  followup_drip_max_minutes?: number;
  audio_enabled?: boolean;
  audio_mode?: 'mirror' | 'always' | 'never';
  audio_voice_id?: string | null;
  sales_method?: SalesMethod;
  social_proof?: string | null;
  booking_enabled?: boolean;
  visit_duration_minutes?: number;
  example_conversations?: SalesAgentExample[];
  visit_config?: VisitConfig;
  default_property_code?: string | null;
  locacao_enabled?: boolean;
  escalate_on_frustration?: boolean;
  escalate_on_human_request?: boolean;
  escalate_on_ai_detected?: boolean;
  ai_limits?: AiLimits;
  crm_policy?: CrmPolicy;
  transfer_config?: TransferConfig;
  ask_google_review?: boolean;
  google_review_link?: string | null;
  cross_sell_enabled?: boolean;
  rich_media_enabled?: boolean;
  default_origin?: string | null;
  intent_question?: string | null;
  opening_image_url?: string | null;
  opening_audio_url?: string | null;
  openings?: SalesAgentOpening[];
  priority?: number;
  followup_hours?: ActiveHours;
  out_of_hours_reply?: boolean;
  out_of_hours_message?: string | null;
  catalog_search_enabled?: boolean;
  /** A IA responde em várias mensagens curtas em vez de um parágrafo único. */
  message_split_enabled?: boolean;
  message_split_max_parts?: number;
  /** A IA move o card do lead no funil conforme a conversa anda. */
  pipeline_move_enabled?: boolean;
  /** Mapa "etapa da IA -> coluna do funil". Etapa ausente = não move. */
  pipeline_stage_map?: Record<string, string>;
  /** A IA pode mandar sozinha o book cadastrado no imóvel. */
  send_property_book_enabled?: boolean;
  /** Regra escrita uma vez, valendo pro book de QUALQUER imóvel. */
  book_send_rule?: string | null;
  /** A IA pode CURTIR mensagens do lead: a reação com emoji, no aparelho dele. */
  reaction_enabled?: boolean;
  /** Os únicos emojis que ela pode usar. Lista vazia = volta ao padrão de fábrica. */
  reaction_emojis?: string[];
  /** Teto de curtidas por conversa. Zero desliga a curtida. */
  reaction_max_per_conversation?: number | null;
}

export interface SalesAgentDocument {
  id: string;
  sales_agent_id: string;
  title: string;
  source_type: 'file' | 'text' | 'url';
  source_url: string | null;
  char_count: number;
  tags: string[];
  /**
   * `no_text` = arquivo íntegro, sem camada de texto (PDF escaneado, imagem). Não é
   * falha: ele serve pro envio, só não entra na base de conhecimento.
   */
  status: 'pending' | 'ready' | 'no_text' | 'failed';
  error_message: string | null;
  has_file: boolean;
  filename: string | null;
  preview: string;
  // --- envio pro lead ---
  sendable: boolean;
  learnable: boolean;
  send_once: boolean;
  send_when: string | null;
  send_when_not: string | null;
  send_caption: string | null;
  send_topics: string[];
  property_codes: string[];
  media_kind: 'document' | 'image' | 'audio';
  file_url: string | null;
  byte_size: number;
  size_label: string | null;
  /**
   * Como o arquivo SAI hoje, calculado no servidor pra a tela não duplicar (e
   * divergir da) regra de tamanho: 'file' viaja inteiro, 'link' é grande demais e vai
   * como endereço, 'blocked' não tem como sair.
   */
  send_mode: 'file' | 'link' | 'blocked' | null;
  created_at: string;
  updated_at: string;
}

/** O que a ficha "Como a IA deve usar este arquivo" salva. */
export interface SalesAgentDocumentConfig {
  title?: string;
  sendable?: boolean;
  learnable?: boolean;
  send_once?: boolean;
  send_when?: string;
  send_when_not?: string;
  send_caption?: string;
  send_topics?: string[];
  property_codes?: string[];
}

/**
 * Foto e link que o lead REAL receberia junto do texto. No teste não existe canal
 * pra enviar, então em vez de a mídia sumir (e a IA parecer que prometeu e não
 * cumpriu) a tela mostra o que teria ido.
 */
export interface TestMediaItem {
  type: 'image' | 'link' | 'file';
  /** Só em foto e link — arquivo não tem endereço no painel, ele só é anunciado. */
  url?: string;
  caption?: string;
  // --- só em 'file' ---
  kind?: 'document' | 'image' | 'audio';
  title?: string;
  /** Por que ela escolheu mandar agora. Serve pra calibrar a regra. */
  reason?: string | null;
}

export interface SalesAgentTestResult {
  /** O texto inteiro da resposta. Continua existindo pra tudo que lê "a resposta". */
  reply: string;
  /**
   * As mensagens na ordem em que o lead as receberia, quando a quebra está ligada.
   * Sem isto o painel Testar mostraria UMA bolha mesmo com a chave ligada, e quem
   * testasse concluiria que a funcionalidade não funciona.
   */
  reply_parts?: string[];
  media?: TestMediaItem[];
  temperature: 'hot' | 'warm' | 'cold' | 'unknown';
  should_transfer: boolean;
  transfer_reason: string | null;
  collected: Record<string, unknown>;
  lead_summary: string;
  stage?: string | null;
  book_visit?: { should_book: boolean; date: string | null; time: string | null; notes: string | null } | null;
  bant?: { budget?: string | null; authority?: string | null; need?: string | null; timeline?: string | null };
  qualified?: boolean | null;
}

export interface TestHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * O que o lead real traz junto da primeira mensagem e o teste digitado à mão não
 * tem como reproduzir.
 */
export interface TestLeadContext {
  contactName?: string;
  /** De onde veio: campanha, anúncio, plataforma. */
  source?: string;
  /** Interesse inicial declarado (ex.: veio de um formulário perguntando isso). */
  interest?: string;
  /** Respostas do formulário do Meta — a IA usa pra não perguntar de novo. */
  formAnswers?: Record<string, string>;
  propertyCode?: string;
}

/** Contexto lido de uma conversa real, pra carregar no painel de teste. */
export interface LoadedConversationContext {
  conversation_id: string;
  history: TestHistoryItem[];
  contact_name: string | null;
  source: string | null;
  interest: string | null;
  form_answers: Record<string, string>;
  property_code: string | null;
}

export type SalesAgentLessonKind = 'rule' | 'good_example' | 'bad_example';
export interface SalesAgentLesson {
  id: string;
  kind: SalesAgentLessonKind;
  content: string;
  context: string | null;
  enabled: boolean;
  created_at: string;
}

export interface SalesAgentPropertyLink {
  link: string;
  message: string;
  number: string;
  property: { id: string; code: string; title: string } | null;
}

// --- sugestões da IA e relatório semanal ---

export type SuggestionStatus = 'pending' | 'applied' | 'dismissed';
export type SuggestionTarget = 'ia' | 'equipe';
export type SuggestionCategory = 'objecao' | 'pergunta' | 'travamento' | 'operacao';

export interface SalesAgentSuggestion {
  id: string;
  status: SuggestionStatus;
  /**
   * ⚠️ `ia` vira lição; `equipe` NUNCA vira. Lição é injetada no comando da IA, e
   * um recado de time virando lição faz ela repetir "o corretor demora a
   * responder" para o LEAD. Quem manda no botão é `appliable`, que vem do
   * servidor — a tela não deduz isso.
   */
  target: SuggestionTarget;
  category: SuggestionCategory;
  category_label: string;
  title: string;
  body: string | null;
  evidence: { conversations?: number; quotes?: string[] };
  appliable: boolean;
  lesson_kind: SalesAgentLessonKind | null;
  lesson_content: string | null;
  applied_lesson_id: string | null;
  batch_id: string;
  created_at: string;
}

export interface SuggestionAutoConfig {
  auto: boolean;
  weekday: number;
  hour: number;
}

export interface SuggestionsPayload {
  suggestions: SalesAgentSuggestion[];
  /** Quantas lições a IA tem ativas, e quantas ela de fato lê (teto por tipo). */
  lessons_active: number;
  lessons_cap: number;
  last_analysis_at: string | null;
  last_analysis_cost_usd: number;
  auto: SuggestionAutoConfig;
  created?: number;
  cost_usd?: number;
}

export interface WeeklyReportConfig {
  enabled: boolean;
  weekday: number;
  hour: number;
  group_jids: string[];
  user_ids: string[];
}

export interface WeeklyReportResult {
  kind: string;
  label: string;
  ok: boolean;
  detail: string | null;
}

export interface WeeklyReport {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  status: 'draft' | 'sent' | 'failed';
  automatic: boolean;
  text: string | null;
  stats: {
    ia?: Record<string, number>;
    equipe?: Record<string, unknown>;
  };
  destinations: { kind: string; label: string }[];
  results: WeeklyReportResult[];
  delivered_count: number;
  failed_count: number;
  cost_usd: number;
  sent_at: string | null;
  created_at: string;
}

export interface WeeklyReportPayload {
  config: WeeklyReportConfig;
  current: WeeklyReport | null;
  history: WeeklyReport[];
}

export interface WeeklyReportTargets {
  /** Só os grupos DESTE cliente. O servidor nunca devolve os dos outros. */
  groups: { jid: string; name: string; source: 'cadastro' | 'nome' }[];
  managers: { id: string; name: string; phone_masked: string }[];
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

  // Formulário -> JSON: o dono responde perguntas e o Claude monta a config.
  async generateConfig(answers: Record<string, string>): Promise<GeneratedAgentConfig> {
    const res = await api.post(`${BASE}/generate_config`, { answers });
    return (res.data as { data: GeneratedAgentConfig }).data;
  },

  /**
   * O `context` é o que separa o teste da conversa real: o lead de verdade chega
   * com nome, origem de campanha e respostas do formulário do Meta, e é isso que
   * faz a IA saber do que está falando em vez de perguntar de novo. O backend
   * sempre aceitou esses campos — a tela é que mandava só o nome, chumbado.
   */
  async testRun(
    id: string,
    message: string,
    history: TestHistoryItem[] = [],
    context: TestLeadContext = {},
  ): Promise<SalesAgentTestResult> {
    const res = await api.post(`${BASE}/${id}/test_run`, {
      message,
      history,
      contact_name: context.contactName || undefined,
      source: context.source || undefined,
      interest: context.interest || undefined,
      form_answers: Object.keys(context.formAnswers ?? {}).length ? context.formAnswers : undefined,
      property_code: context.propertyCode || undefined,
    });
    return (res.data as { data: SalesAgentTestResult }).data;
  },

  /**
   * Carrega uma conversa REAL no painel de teste (histórico + contexto do lead).
   * Só leitura: não chama o Claude, não grava e não envia mensagem, então dá pra
   * apontar pra um lead ativo sem risco.
   */
  async conversationContext(
    id: string,
    opts: { conversationId?: string; phone?: string },
  ): Promise<LoadedConversationContext> {
    const res = await api.get(`${BASE}/${id}/conversation_context`, {
      params: { conversation_id: opts.conversationId || undefined, phone: opts.phone || undefined },
    });
    return (res.data as { data: LoadedConversationContext }).data;
  },

  // Ativa a IA pra atender um lead escolhido (proativo): inicia OU continua a
  // conversa lendo todo o histórico. fresh=true reinicia do zero (abertura).
  async engage(
    id: string,
    opts: { conversationId?: string; phone?: string; propertyCode?: string; fresh?: boolean },
  ): Promise<{ conversation_id: string }> {
    const res = await api.post(`${BASE}/${id}/engage`, {
      conversation_id: opts.conversationId || undefined,
      phone: opts.phone || undefined,
      property_code: opts.propertyCode || undefined,
      fresh: opts.fresh || undefined,
    });
    return (res.data as { data: { conversation_id: string } }).data;
  },

  // Gera o link wa.me pra colar no anúncio (código do imóvel + palavra-gatilho).
  async propertyLink(id: string, propertyCode?: string): Promise<SalesAgentPropertyLink> {
    const res = await api.get(`${BASE}/${id}/property_link`, {
      params: { property_code: propertyCode || undefined },
    });
    return (res.data as { data: SalesAgentPropertyLink }).data;
  },

  // --- diagnóstico e caixa-preta ---

  // Checklist de "essa IA está mesmo no ar?": canal, credenciais da Evolution,
  // chave da IA, base de conhecimento, horário, gatilhos e disputa de agentes.
  // O RESULTADO desta IA, pra aba Resultados. Mesma medição que a Leal Mídia usa
  // no painel dela — de propósito: dois números diferentes pro mesmo fato
  // transformariam qualquer conversa numa discussão sobre qual painel mente.
  // Devolve null quando esta IA ainda não tem nenhum registro no período.
  async performance(id: string, days = 30): Promise<AgentPerformance | null> {
    const res = await api.get(`${BASE}/${id}/performance`, { params: { days } });
    return (res.data as { data: AgentPerformance | null }).data ?? null;
  },

  async diagnostics(id: string): Promise<HealthReport> {
    const res = await api.get(`${BASE}/${id}/diagnostics`);
    return (res.data as { data: HealthReport }).data;
  },

  // Últimos turnos: o que respondeu, o que pulou (com o motivo) e o que falhou
  // (com o erro real). Antes isso só existia no log do Railway.
  async runs(
    id: string,
    opts: { status?: string; days?: number; limit?: number } = {},
  ): Promise<{ runs: SalesAgentRun[]; totals: SalesAgentRunTotals }> {
    const res = await api.get(`${BASE}/${id}/runs`, {
      params: { status: opts.status || undefined, days: opts.days ?? 30, limit: opts.limit ?? 50 },
    });
    return (res.data as { data: { runs: SalesAgentRun[]; totals: SalesAgentRunTotals } }).data;
  },

  // Monta o system prompt SEM chamar o Claude (custo zero) e confirma se o
  // cérebro universal, a base do cliente e as lições chegaram. Existia na API
  // desde sempre e não tinha botão em lugar nenhum.
  async testPrompt(id: string, message?: string): Promise<PromptPreview> {
    const res = await api.post(`${BASE}/${id}/test_prompt`, { message: message || undefined });
    return (res.data as { data: PromptPreview }).data;
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

  async uploadFileDocument(
    agentId: string,
    file: File,
    title?: string,
    onProgress?: (percent: number) => void,
  ): Promise<SalesAgentDocument> {
    const form = new FormData();
    form.append('source_type', 'file');
    form.append('file', file);
    if (title) form.append('title', title);
    const res = await api.post(`${BASE}/${agentId}/documents`, form, {
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return (res.data as { data: SalesAgentDocument }).data;
  },

  /**
   * Salva as regras de uso do arquivo (quando enviar, quando não, legenda). Separado
   * do upload de propósito: as perguntas são respondidas DEPOIS que o arquivo sobe, e
   * sem este caminho o dono teria que apagar e subir de novo a cada ajuste de regra.
   */
  async updateDocument(
    agentId: string,
    docId: string,
    config: SalesAgentDocumentConfig,
  ): Promise<SalesAgentDocument> {
    const res = await api.patch(`${BASE}/${agentId}/documents/${docId}`, config);
    return (res.data as { data: SalesAgentDocument }).data;
  },

  async destroyDocument(agentId: string, docId: string): Promise<void> {
    await api.delete(`${BASE}/${agentId}/documents/${docId}`);
  },

  /**
   * Sobe o print/áudio de abertura e devolve a URL pronta. O formato do dado no banco
   * continua sendo URL — o que muda é só de onde ela vem: antes era preciso hospedar
   * a imagem em algum lugar e colar o endereço, o que na prática significava não usar
   * o recurso.
   */
  async uploadMedia(
    agentId: string,
    file: File,
    kind: 'image' | 'audio',
    onProgress?: (percent: number) => void,
  ): Promise<{ url: string; content_type: string; byte_size: number }> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await api.post(`${BASE}/${agentId}/upload_media`, form, {
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return (res.data as { data: { url: string; content_type: string; byte_size: number } }).data;
  },

  async reprocessDocument(agentId: string, docId: string): Promise<SalesAgentDocument> {
    const res = await api.post(`${BASE}/${agentId}/documents/${docId}/reprocess`);
    return (res.data as { data: SalesAgentDocument }).data;
  },

  // --- aprendizado (lições: feedback -> regra / exemplo) ---

  async listLessons(agentId: string): Promise<SalesAgentLesson[]> {
    const res = await api.get(`${BASE}/${agentId}/lessons`);
    return (res.data as { data: SalesAgentLesson[] }).data ?? [];
  },

  async createLesson(
    agentId: string,
    kind: SalesAgentLessonKind,
    content: string,
    context?: string,
  ): Promise<SalesAgentLesson> {
    const res = await api.post(`${BASE}/${agentId}/lessons`, { kind, content, context: context || undefined });
    return (res.data as { data: SalesAgentLesson }).data;
  },

  async destroyLesson(agentId: string, lessonId: string): Promise<void> {
    await api.delete(`${BASE}/${agentId}/lessons/${lessonId}`);
  },

  // --- sugestões da IA (ela relê as conversas e propõe melhorias) ---

  async listSuggestions(agentId: string): Promise<SuggestionsPayload> {
    const res = await api.get(`${BASE}/${agentId}/suggestions`);
    return (res.data as { data: SuggestionsPayload }).data;
  },

  async analyzeSuggestions(agentId: string, days = 30): Promise<SuggestionsPayload> {
    const res = await api.post(`${BASE}/${agentId}/suggestions/analyze`, { days });
    return (res.data as { data: SuggestionsPayload }).data;
  },

  async applySuggestion(agentId: string, id: string): Promise<SalesAgentSuggestion> {
    const res = await api.post(`${BASE}/${agentId}/suggestions/${id}/apply`);
    return (res.data as { data: SalesAgentSuggestion }).data;
  },

  async dismissSuggestion(agentId: string, id: string): Promise<SalesAgentSuggestion> {
    const res = await api.post(`${BASE}/${agentId}/suggestions/${id}/dismiss`);
    return (res.data as { data: SalesAgentSuggestion }).data;
  },

  /**
   * A chave "analisar sozinha toda semana". Endpoint PRÓPRIO, e não um campo do
   * agente: campo do agente precisa entrar na lista campo-a-campo do `saveAgent`,
   * e o que fica de fora é descartado em silêncio — a tela mostra o valor, o
   * toast diz "Salvo", e nada foi salvo.
   */
  async saveSuggestionConfig(agentId: string, patch: Partial<SuggestionAutoConfig>): Promise<SuggestionAutoConfig> {
    const res = await api.patch(`${BASE}/${agentId}/suggestions/config`, patch);
    return (res.data as { data: SuggestionAutoConfig }).data;
  },

  // --- relatório semanal (é do CLIENTE, não de uma IA: rota fora de /sales_agents) ---

  async weeklyReport(): Promise<WeeklyReportPayload> {
    const res = await api.get('/weekly_reports');
    return (res.data as { data: WeeklyReportPayload }).data;
  },

  async weeklyReportTargets(): Promise<WeeklyReportTargets> {
    const res = await api.get('/weekly_reports/targets');
    return (res.data as { data: WeeklyReportTargets }).data;
  },

  async weeklyReportPreview(weekStart?: string): Promise<WeeklyReport> {
    const res = await api.post('/weekly_reports/preview', { week_start: weekStart || undefined });
    return (res.data as { data: WeeklyReport }).data;
  },

  async weeklyReportSaveText(text: string): Promise<WeeklyReport> {
    const res = await api.patch('/weekly_reports/text', { text });
    return (res.data as { data: WeeklyReport }).data;
  },

  async weeklyReportSendNow(): Promise<WeeklyReport> {
    const res = await api.post('/weekly_reports/send_now');
    return (res.data as { data: WeeklyReport }).data;
  },

  async saveWeeklyReportConfig(patch: Partial<WeeklyReportConfig>): Promise<WeeklyReportConfig> {
    const res = await api.patch('/weekly_reports/config', patch);
    return (res.data as { data: WeeklyReportConfig }).data;
  },
};

export default salesAgentsService;
