import api from '@/services/core/api';
import type { AgentPerformance } from '@/types/aiResults';

export type SalesAgentMode = 'seller' | 'sdr' | 'assistant';

/**
 * As TRÊS ESCOLHAS da IA (refatoração, entrega 2). O servidor devolve persona e
 * alcance sempre RESOLVIDOS (coluna, senão lido das antigas: voz em primeira pessoa
 * → corretor; agendar visita → vai até o fim). Ver features/salesAgents/tresEscolhas.ts.
 *
 * ⚠️ `assistant` aqui é a "assistente da imobiliária", NÃO o `mode = 'assistant'`
 * (o corretor conduz e a IA só sugere).
 */
export type PersonaDaIa = 'broker' | 'owner' | 'assistant';
export type AlcanceDaIa = 'qualify' | 'visit';
export type TomDaIa = 'close' | 'formal';
export type EmojiDaIa = 'none' | 'light';

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

export type SalesAgentTriggerType = 'keyword' | 'origin' | 'property' | 'pipeline_stage' | 'pipeline' | 'tag' | 'form';
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
  form_ids?: string[];   // form: form_id das configs de Origem → Formulários
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
  /** Modelo do Testar (Haiku por padrão). Vem do servidor (`resolved_test_model`). */
  test_model?: string | null;
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
  /** O que a IA faz quando o lead some. 'pipeline' = move o card pra coluna do
   *  silêncio e quem manda a mensagem é o follow-up que aquela coluna dispara;
   *  'sequence' = entrega o lead ao follow-up escolhido (`followup_flow_id`), sem
   *  mexer no card. IA nova nasce em 'sequence' apontando pro Follow-up padrão.
   *  'ai' (a IA escrevia a mensagem) é só valor ANTIGO de leitura desde 06/10/2026:
   *  a tela não oferece mais e o servidor recusa gravar. */
  followup_action: SalesAgentFollowupAction;
  followup_stage_id: string | null;
  /** Coluna de volta quando o lead responde. Vazia = a primeira coluna do funil. */
  followup_return_stage_id: string | null;
  followup_sequence_slug: string | null;
  /** Sprint 3 (03/10/2026): o fluxo de follow-up que recebe o lead em
   *  "Entregar pro follow-up". Sem ele, o servidor usa o funil antigo do slug
   *  (e o redireciona pro fluxo convertido). */
  followup_flow_id?: string | null;
  /** Gotejamento: a IA entrega um punhado de leads por vez, com pausa sorteada
   *  entre um punhado e o próximo. Sem ele saem até 200 de uma vez, e o funil
   *  despeja até 100 mensagens a cada 5 min — é assim que um número é derrubado. */
  followup_drip_enabled: boolean;
  followup_drip_min_leads: number;
  followup_drip_max_leads: number;
  followup_drip_min_minutes: number;
  followup_drip_max_minutes: number;
  /** Recorte por funil do follow-up, por cima do público fixo do servidor (só
   *  lead que ela atendeu e que não foi para a roleta). Lista VAZIA = todos os
   *  leads desse público — não é "nenhum funil, não sai nada". */
  followup_pipeline_ids: string[];
  /** Reengajamento: antes do follow-up, a IA retoma a pergunta que ficou no ar
   *  (1ª depois de `first_hours` sem resposta, 2ª `second_hours` depois da 1ª).
   *  Só vale com o follow-up ligado. Horas de 1 a 48; o servidor manda resolvidas. */
  reengagement_enabled: boolean;
  reengagement_first_hours: number;
  reengagement_second_hours: number;
  /** PARA ONDE ela entrega o lead quando passa pro corretor.
   *
   *  `roleta` entrega numa roleta escolhida. `user` entrega a um corretor fixo,
   *  sem roleta nenhuma. `inbox_roleta` (a roleta do NÚMERO da conversa) é valor
   *  antigo, só de leitura: desde a roleta nova (06/10/2026) a roleta não tem
   *  número e o servidor recusa gravá-lo. */
  handoff_target: SalesAgentHandoffTarget;
  /** Sistema do cliente: o endereço que recebe o lead (só vale com `handoff_target = 'webhook'`). */
  handoff_webhook_url?: string | null;
  /** Se a chave secreta já foi gerada. A chave em si nunca vem do servidor. */
  handoff_webhook_secret_set?: boolean;
  /** Estado da chave: 'unreadable' = a chave gravada não abre mais (gere outra). */
  handoff_webhook_secret_state?: 'none' | 'ready' | 'unreadable';
  handoff_roleta_config_id: string | null;
  handoff_user_id: string | null;
  /** Quem ela é. Sempre resolvido pelo servidor. */
  persona_kind: PersonaDaIa;
  /** Até onde ela vai. Sempre resolvido pelo servidor (espelha `booking_enabled`). */
  reach: AlcanceDaIa;
  /** Nome que o lead vê (o roteiro de hoje já o diz). Separado do `name`, que é o nome da IA no LM Flow. */
  lead_facing_name: string | null;
  /** Tom e emoji: gravados desde a entrega 2, sem controle na tela até a entrega 4 (roteiro novo). */
  tone?: TomDaIa | null;
  emoji_use?: EmojiDaIa | null;
  /** Dono EFETIVO do número dela (ativo, fora da equipe da Leal Mídia). Ausente = servidor antigo. */
  number_owner_id?: string | null;
  number_owner_name?: string | null;
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
  /** Os 3 caminhos de fábrica (Moradia, Investimento, Sondando), pra tela mostrar quando a lista gravada está vazia. */
  intent_paths_default?: CaminhoDaIntencao[];
  opening_image_url: string | null;
  opening_audio_url: string | null;
  openings: SalesAgentOpening[];
  /**
   * O ROTEIRO desta IA: os blocos do comando que alguém reescreveu para ESTE
   * cliente, mais `intent_question_mode` (sempre / só na abertura / nunca).
   *
   * Chave AUSENTE não é "bloco vazio": é "usa o padrão de fábrica". Quem lê o
   * texto em uso de cada bloco é o endpoint `playbook`, não este campo — aqui só
   * viaja o que foi reescrito.
   */
  playbook?: AgentPlaybookConfig;
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
  kind: 'live' | 'followup' | 'engage' | 'test' | 'reengage';
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
/**
 * O que a IA faz quando o lead some.
 *
 * ⚠️ 'ai' é LEGADO, só de leitura (06/10/2026, spec 2026-10-06-follow-up-padrao):
 * "A IA escreve a mensagem" saiu da tela e o servidor recusa gravar 'ai' quando o
 * valor muda. Continua no tipo porque IA antiga ainda pode vir assim até o rake
 * `lm_flow:followup_padrao:aplicar` trocar todas; a tela mostra a escolha vazia com
 * aviso. O que se pode GRAVAR é `SalesAgentFollowupChoice`.
 */
export type SalesAgentFollowupAction = 'ai' | 'pipeline' | 'sequence';
export type SalesAgentFollowupChoice = Exclude<SalesAgentFollowupAction, 'ai'>;

export type HandoffMode = 'duvida' | 'temperatura' | 'checklist' | 'sem_resposta' | 'pos_visita';

/**
 * PARA ONDE a IA entrega o lead ao transferir.
 *
 * `inbox_roleta` era a roleta do número da conversa. Desde a roleta nova
 * (06/10/2026) é valor antigo, só de leitura: a tela mostra "Uma roleta" com a
 * roleta que atendia o número (passo 2) e o servidor recusa gravá-lo.
 *
 * `number_owner` é o dono do número da conversa: o único destino da persona "o próprio corretor".
 */
export type SalesAgentHandoffTarget = 'inbox_roleta' | 'roleta' | 'user' | 'number_owner' | 'webhook';

/**
 * O que se GRAVA no destino (onda 2, 06/10/2026). `inbox_roleta` ("a roleta deste
 * número") saiu da tela: o servidor ainda LÊ, mas recusa em gravação nova, e a
 * rotina `ia:destino_sem_inbox_roleta` troca as IAs antigas pela roleta do número.
 */
export type SalesAgentHandoffChoice = Exclude<SalesAgentHandoffTarget, 'inbox_roleta'>;

/** Persona que se GRAVA: `owner` (Dono da imobiliária) saiu (onda 2); lido como Consultora. */
export type PersonaGravavel = Exclude<PersonaDaIa, 'owner'>;

export interface TransferConfig {
  mode?: HandoffMode;
  min_temperature?: 'hot' | 'warm';
  /**
   * As perguntas de qualificação que SEGURAM a entrega do lead, pelo TEXTO delas.
   * Só é lida no cenário do checklist.
   *
   * ⚠️ Lista VAZIA (ou ausente) significa TODAS as perguntas, não nenhuma: o portão
   * vazio faria o cenário decorativo — a tela dizendo "só entrego com a ficha
   * preenchida" e o servidor liberando todo lead. Quem decide isso é o servidor; a
   * tela só precisa DIZER ao gestor que é assim.
   */
  required_questions?: string[];
  /**
   * Mandar junto com o lead, no repasse, o resumo do que a IA descobriu.
   *
   * ⚠️ Lida com `!== false`: agente que nunca viu a chave fica LIGADO — o resumo
   * estreou em todas as imobiliárias, e a chave existe para desligar em quem não
   * quiser. Ver features/salesAgents/handoffBriefing.ts.
   */
  briefing_enabled?: boolean;
  /**
   * `first_person` = a IA atende no WhatsApp de UM corretor e fala como ele: nunca
   * "vou te passar pra um colega do time". Ausente = o padrão de sempre. Ver
   * features/salesAgents/handoffVoice.ts.
   */
  voice?: 'first_person';
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
  /**
   * Visita para HOJE a IA nunca confirma sozinha: ela passa o lead para o corretor.
   * Ausente = LIGADO (é a regra, não uma funcionalidade a liberar aos poucos).
   */
  same_day_requires_human?: boolean;
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

/**
 * Um bloco do comando da IA.
 *
 * `content` é o texto EM USO ainda com os encaixes ({situacao}, {lista_objecoes}...)
 * — é o que se reescreve. `resolved` é o que a IA de fato lê, com os pontos-chave
 * desta imobiliária já no lugar. `factory_default` (cru, com os encaixes) é o que
 * o "voltar ao padrão" restaura. `allowed_markers` é o que o bloco aceita entre
 * chaves — marcador fora da lista é recusado pelo servidor.
 */
export interface PlaybookBlock {
  key: string;
  label: string;
  content: string;
  resolved: string;
  factory_default: string;
  customized: boolean;
  allowed_markers: string[];
}

export interface PlaybookObjection {
  objecao: string;
  resposta: string;
}

/**
 * Os PONTOS-CHAVE da venda desta imobiliária — o que preenche os encaixes do
 * alicerce. Chave ausente = exemplo de fábrica.
 */
/**
 * Um caminho da INTENÇÃO (onda 2, 06/10/2026): a resposta do lead à pergunta de
 * intenção e como ela conduz dali. Grava em `playbook.vars.caminhos_intencao` (até
 * 5; nome até 40, como até 300). Lista vazia/ausente = os 3 de fábrica, que o
 * servidor devolve em `intent_paths_default` — nenhuma IA muda sozinha.
 */
export interface CaminhoDaIntencao {
  nome: string;
  como: string;
}

/** Uma voz do catálogo (ElevenLabs). `preview_url` é a amostra da própria ElevenLabs: ouvir não gasta nada. */
export interface VozDaIa {
  id: string;
  nome: string;
  descricao: string;
  genero: 'feminina' | 'masculina';
  preview_url: string | null;
}

export interface PlaybookVars {
  tipo_venda?: string;
  perguntas_situacao?: string[];
  dor_tipica?: string;
  lead_pronto?: string;
  proximo_passo?: string;
  objecoes?: PlaybookObjection[];
  /** Onda 2 (06/10/2026): os caminhos da intenção. Ver `CaminhoDaIntencao`. */
  caminhos_intencao?: CaminhoDaIntencao[];
}

/**
 * O que viaja no campo `playbook` do agente: os blocos reescritos (texto), o
 * modo da pergunta de intenção e os pontos-chave em `vars`.
 */
export type AgentPlaybookConfig = Record<string, string | PlaybookVars | undefined>;

/** sempre / só na abertura / nunca. */
export type IntentQuestionMode = 'always' | 'opening_only' | 'never';

export interface PlaybookOption {
  value: string;
  label: string;
}

export interface AgentPlaybook {
  intent_question_mode: IntentQuestionMode;
  intent_question_modes: IntentQuestionMode[];
  vars: PlaybookVars;
  slot_defaults: {
    tipo_venda: string;
    perguntas_situacao: string;
    dor_tipica: string;
    lead_pronto: string;
    proximo_passo: string;
    objecoes: PlaybookObjection[];
  };
  var_labels: Record<string, string>;
  var_hints: Record<string, string>;
  sale_types: PlaybookOption[];
  next_steps: PlaybookOption[];
  blocks: PlaybookBlock[];
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
  followup_action?: SalesAgentFollowupChoice;
  followup_stage_id?: string | null;
  followup_return_stage_id?: string | null;
  followup_sequence_slug?: string | null;
  followup_flow_id?: string | null;
  followup_drip_enabled?: boolean;
  followup_drip_min_leads?: number;
  followup_drip_max_leads?: number;
  followup_drip_min_minutes?: number;
  followup_drip_max_minutes?: number;
  followup_pipeline_ids?: string[];
  reengagement_enabled?: boolean;
  reengagement_first_hours?: number;
  reengagement_second_hours?: number;
  handoff_target?: SalesAgentHandoffChoice;
  handoff_webhook_url?: string | null;
  handoff_roleta_config_id?: string | null;
  handoff_user_id?: string | null;
  persona_kind?: PersonaGravavel;
  reach?: AlcanceDaIa;
  lead_facing_name?: string | null;
  tone?: TomDaIa | null;
  emoji_use?: EmojiDaIa | null;
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
  /** O roteiro reescrito para este cliente. `{}` = tudo no padrão de fábrica. */
  playbook?: AgentPlaybookConfig;
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
  media_kind: 'document' | 'image' | 'audio' | 'video';
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
 * O que o lead REAL receberia junto do texto. No teste não existe canal pra
 * enviar, então em vez de a mídia sumir (e a IA parecer que prometeu e não
 * cumpriu) a tela mostra o que teria ido. 'photos' = o pacote de fotos do imóvel,
 * com as miniaturas exatas, na ordem em que iriam.
 */
export interface TestMediaItem {
  type: 'image' | 'link' | 'file' | 'photos';
  /** Só em foto e link. */
  url?: string;
  /** Só em 'photos': as fotos do pacote, na ordem. */
  urls?: string[];
  caption?: string | null;
  // --- 'file' e 'photos' ---
  kind?: 'document' | 'image' | 'audio' | 'video';
  title?: string;
  /** Por que ela escolheu mandar agora. Serve pra calibrar a regra. */
  reason?: string | null;
  /**
   * Identifica ESTE item pro botão "Mandar pra mim" (`test_send`) — sem ele a
   * tela precisaria resolver de novo qual arquivo/pacote é este. Só em 'photos'
   * e 'file'.
   */
  token?: string;
}

export interface TestHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------- Testar fiel (ensaio) ----------------
// O estado do ensaio mora AQUI, no navegador: o servidor devolve o estado novo a
// cada passo e recebe de volta no próximo. Nada é gravado no servidor.

export interface RehearsalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  marks: Record<string, boolean>;
}

export interface RehearsalState {
  v: 1;
  now: string;
  contact: { name?: string | null; form_answers?: Record<string, string>; ad_referral?: Record<string, unknown> };
  attrs: Record<string, unknown>;
  labels: string[];
  messages: RehearsalMessage[];
  lead_owner: string | null;
  source_conversation_id: string | null;
  /** O caminho da intenção que ela escolheu (onda 2). Null = ainda não escolheu. */
  caminho?: string | null;
}

export interface RehearsalBubble { content: string; pause_ms: number; audio?: boolean }
export interface RehearsalReason { reason: string; text: string; detail?: string | null }

export interface RehearsalOutcome {
  skipped: RehearsalReason | null;
  warnings: RehearsalReason[];
  handoff: { kind: 'roleta' | 'user' | 'owner' | 'webhook' | 'none'; destination: string | null; problem?: string | null; reason?: string | null } | null;
  handoff_blocked: string | null;
  in_handoff: boolean;
  visit: { date: string; time: string; label: string; realtor: string | null; property_code: string | null; notes: string | null } | null;
  collected: Record<string, unknown>;
  checklist: Array<{ pergunta: string; resposta: string | null; obrigatoria: boolean }>;
  temperature: 'hot' | 'warm' | 'cold' | 'unknown' | null;
  stage: string | null;
  summary: string | null;
  labels: string[];
  card: { stage: string | null; moves: boolean } | null;
  purpose: string | null;
  out_of_hours_notice: boolean;
  opening: string | null;
  /** O modelo que respondeu de fato. */
  model: string | null;
  /** O modelo do teste (Haiku, como hoje); null na comparação, que roda no da IA. */
  test_model: string | null;
  /** O modelo em que esta IA atende o lead de verdade. */
  agent_model: string | null;
  delay_s: number | null;
  notes: RehearsalReason[];
  error: string | null;
  lead_owner: string | null;
}

export interface RehearsalEvent {
  kind: 'reengagement' | 'followup' | 'followup_delegated';
  at: string;
  attempt: number;
  messages: RehearsalBubble[];
  blank: boolean;
}

export interface RehearsalTurn {
  kind: 'reply' | 'silent' | 'error' | 'advance' | 'loaded';
  at: string;
  messages: RehearsalBubble[];
  reaction: string | null;
  note: string | null;
  media: TestMediaItem[];
  outcome: RehearsalOutcome | null;
  events?: RehearsalEvent[];
  idle?: string | null;
  notes?: RehearsalReason[];
}

export interface RehearsalResult { state: RehearsalState; turn: RehearsalTurn }

export interface RehearsalContext {
  contact_name?: string;
  source?: string;
  interest?: string;
  form_answers?: Record<string, string>;
  property_code?: string;
}

export type RehearsalRequest =
  | { step: 'turn'; state: RehearsalState | null; message: string; context?: RehearsalContext; seed?: { history: TestHistoryItem[]; hours_ago?: number } }
  | { step: 'advance'; state: RehearsalState; hours: number | null }
  | { step: 'load'; phone: string };

export type SalesAgentLessonKind = 'rule' | 'good_example' | 'bad_example';
export interface SalesAgentLesson {
  id: string;
  kind: SalesAgentLessonKind;
  content: string;
  context: string | null;
  enabled: boolean;
  created_at: string;
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
  /**
   * A análise NÃO termina dentro da chamada do botão: o servidor derruba qualquer
   * requisição que passe de 15s e a IA leva de 30 a 90 lendo as conversas. O botão
   * só COMEÇA a análise; estes dois campos são como a tela acompanha até o fim.
   */
  analyzing?: boolean;
  /** Motivo em português quando a análise parou. Vem pronto do servidor. */
  analysis_error?: string | null;
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
  /**
   * O que não deu certo ao montar ESTE relatório, em português e pronto do servidor.
   *
   * ⚠️ Existe porque medição quebrada e semana parada produziam a mesma tela: tudo
   * zero, nenhum aviso. Lista vazia = deu tudo certo.
   */
  avisos?: string[];
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
  /**
   * Os NÚMEROS ficam prontos dentro da chamada do botão; a REDAÇÃO da IA é que
   * continua em segundo plano (consulta ao modelo, e o servidor derruba requisição
   * que passe de 15s). Enquanto `building` for true, o relatório já está na tela —
   * o que falta é o texto ganhar a prosa.
   */
  building?: boolean;
  /** Motivo em português quando a redação parou. Vem pronto do servidor. */
  preview_error?: string | null;
}

/** O relatório recém-montado, mais o estado da redação que ficou em segundo plano. */
export interface WeeklyReportPreview {
  report: WeeklyReport | null;
  building: boolean;
  preview_error: string | null;
}

export interface WeeklyReportTargets {
  /** Só os grupos DESTE cliente. O servidor nunca devolve os dos outros. */
  groups: { jid: string; name: string; source: 'cadastro' | 'nome' }[];
  managers: { id: string; name: string; phone_masked: string }[];
}

/**
 * Uma peça do caminho do relatório e o veredito dela, em português.
 *
 * `pendente` é a conferência que ainda está rodando no servidor: as duas do
 * WhatsApp não cabem numa requisição (ver o serviço abaixo).
 */
export interface WeeklyReportCheck {
  chave: string;
  titulo: string;
  situacao: 'ok' | 'alerta' | 'falha' | 'pendente';
  detalhe: string;
}

/** O diagnóstico: o que já foi conferido, e se ainda falta conferência chegando. */
export interface WeeklyReportDiagnostico {
  checks: WeeklyReportCheck[];
  checking: boolean;
}

/** A resposta do "Mandar um lead de teste": o que o sistema do cliente respondeu. */
export interface WebhookTestResult {
  ok: boolean;
  delivery_id?: string | null;
  response_code: number | null;
  response_excerpt: string | null;
  duration_ms: number | null;
  error: string | null;
}

/** Um envio ao sistema do cliente, pra lista do Diagnóstico. */
export interface WebhookDelivery {
  id: string;
  created_at: string;
  mode: 'real' | 'test';
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  response_code: number | null;
  response_excerpt: string | null;
  last_error: string | null;
  duration_ms: number | null;
  delivered_at: string | null;
  failed_at: string | null;
  contact_name: string | null;
  conversation_path: string | null;
}

const BASE = '/sales_agents';

/** O que a duplicação devolve: a IA nova + o que foi copiado junto. */
export interface DuplicatedSalesAgent extends SalesAgent {
  duplicated?: { lessons: number; documents: number; warnings: string[] };
}

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

  /**
   * Cria uma CÓPIA da IA (configuração, lições ativas e base de conhecimento),
   * sempre DESLIGADA, opcionalmente já no outro número. Quem decide o que viaja é
   * o servidor — ele copia pelas colunas do banco, então campo novo vai sozinho.
   */
  async duplicate(
    id: string,
    payload: { name?: string; inbox_id?: string | number | null },
  ): Promise<DuplicatedSalesAgent> {
    const res = await api.post(`${BASE}/${id}/duplicate`, payload);
    return (res.data as { data: DuplicatedSalesAgent }).data;
  },

  // Formulário -> JSON: o dono responde perguntas e o Claude monta a config.
  async generateConfig(answers: Record<string, string>): Promise<GeneratedAgentConfig> {
    const res = await api.post(`${BASE}/generate_config`, { answers });
    return (res.data as { data: GeneratedAgentConfig }).data;
  },

  /**
   * Testar fiel: o MESMO turno do atendimento, em memória (nada sai no WhatsApp,
   * nada é gravado). O estado vai e volta inteiro a cada passo. Em erro, joga a
   * frase do servidor (teto da hora, conversa não achada, teste interrompido).
   */
  async rehearsal(id: string, body: RehearsalRequest): Promise<RehearsalResult> {
    try {
      const res = await api.post(`${BASE}/${id}/rehearsal`, body);
      return (res.data as { data: RehearsalResult }).data;
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      throw new Error(axiosErr.response?.data?.error?.message || 'Não consegui rodar o teste agora.');
    }
  },

  /**
   * "Mandar pra mim": entrega a mídia pro WhatsApp do PRÓPRIO dono, pela mesma
   * SalesAgents::FileDelivery do lead real — a diferença do preview do painel
   * Testar, que só MOSTRA. Não toca conversa/contato/card nenhum.
   *
   * Em erro, joga um Error com a MESMA mensagem do servidor (limite de
   * teste/telefone inválido etc.), pra tela mostrar a frase certa, não um
   * texto genérico.
   */
  async testSend(
    id: string,
    body: { phone: string; token?: string; property_code?: string; document_id?: string },
  ): Promise<{ message: string }> {
    try {
      const res = await api.post(`${BASE}/${id}/test_send`, body);
      return { message: (res.data as { message: string }).message };
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const message = axiosErr.response?.data?.error?.message;
      throw new Error(message || 'Não consegui mandar o teste agora.');
    }
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

  /**
   * Gera uma chave NOVA do sistema do cliente. Ela volta UMA vez, aqui.
   * ⚠️ Com chave já gerada, o servidor exige `confirm: true` ("Sim, gerar outra"):
   * a anterior para de funcionar no sistema do cliente.
   */
  async generateWebhookSecret(id: string, opts: { confirm?: boolean } = {}): Promise<string> {
    const res = await api.post(`${BASE}/${id}/handoff_webhook_secret`, opts.confirm ? { confirm: true } : {});
    return (res.data as { data: { secret: string } }).data.secret;
  },

  /** "Mandar um lead de teste": usa o endereço e a chave GRAVADOS. */
  async testWebhook(id: string): Promise<WebhookTestResult> {
    const res = await api.post(`${BASE}/${id}/handoff_webhook_test`);
    return (res.data as { data: WebhookTestResult }).data;
  },

  async webhookDeliveries(id: string): Promise<WebhookDelivery[]> {
    const res = await api.get(`${BASE}/${id}/handoff_webhook_deliveries`);
    return (res.data as { data: { items: WebhookDelivery[] } }).data.items ?? [];
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

  // O ROTEIRO desta IA, bloco a bloco: o texto em uso, o padrão de fábrica ao lado
  // e se alguém já reescreveu aquele bloco. É o que a seção "Roteiro da conversa"
  // desenha, e é o que dá o "voltar ao padrão".
  async playbook(id: string): Promise<AgentPlaybook> {
    const res = await api.get(`${BASE}/${id}/playbook`);
    return (res.data as { data: AgentPlaybook }).data;
  },

  // As vozes do catálogo (onda 2): a lista curada no servidor, com a amostra da
  // ElevenLabs guardada por 24 h. Leitura de fundo: quem chama trata a falha.
  async voices(): Promise<VozDaIa[]> {
    const res = await api.get(`${BASE}/voices`);
    const corpo = res.data as { voices?: VozDaIa[]; data?: { voices?: VozDaIa[] } };
    return corpo.voices ?? corpo.data?.voices ?? [];
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

  /**
   * Monta a prévia e DEVOLVE O RELATÓRIO JÁ PRONTO — os números saem dentro desta
   * chamada. Só a redação da IA fica em segundo plano; `building` diz se ela ainda
   * está sendo escrita, e aí quem acompanha é `weeklyReport()`.
   *
   * ⚠️ Antes isto devolvia quase sempre `null` ("comecei, pergunte depois"), e a tela
   * dependia do segundo plano para ter QUALQUER relatório. Não voltar a esperar: um
   * tropeço na fila deixava o gestor sem nada, sem nada explicando.
   */
  async weeklyReportPreview(weekStart?: string): Promise<WeeklyReportPreview> {
    const res = await api.post('/weekly_reports/preview', { week_start: weekStart || undefined });
    const data = (res.data as { data: (WeeklyReport & { building?: boolean; preview_error?: string | null }) | null })
      ?.data ?? null;
    return {
      report: data,
      building: data?.building ?? false,
      preview_error: data?.preview_error ?? null,
    };
  },

  /**
   * "Por que não está saindo?" — o veredito de cada peça do caminho, em português.
   *
   * ⚠️ Vem em DUAS levas, e por obrigação: as conferências de banco e configuração
   * saem na hora, mas as duas que falam com o WhatsApp operacional esperam até 25
   * segundos somados no servidor — e ele derruba qualquer requisição aos 15, sem
   * motivo dentro. Na estreia foi assim que o próprio diagnóstico falhou. Elas
   * chegam como `pendente` e o servidor as responde numa consulta seguinte;
   * `checking` diz quando ainda falta.
   *
   * `refresh` é o CLIQUE (confere de novo); a espera pergunta sem ele, senão cada
   * pergunta reiniciaria a conferência que está em andamento.
   */
  async weeklyReportDiagnostico(refresh = false): Promise<WeeklyReportDiagnostico> {
    const res = await api.get('/weekly_reports/diagnostico', refresh ? { params: { refresh: 1 } } : undefined);
    const data = (res.data as { data: { checks?: WeeklyReportCheck[]; checking?: boolean } }).data;
    return { checks: data?.checks ?? [], checking: data?.checking ?? false };
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
