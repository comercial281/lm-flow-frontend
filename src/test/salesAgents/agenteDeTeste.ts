import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

/**
 * Uma IA "antiga" de exemplo pros testes do passo a passo: fala como o corretor
 * (voz em primeira pessoa) e entrega pra um corretor fixo que NÃO é o dono do
 * número — o caso que mais pode dar errado na entrega 2. Cada teste troca o que
 * precisa com `extra`.
 */
export function agenteDeTeste(extra: Partial<SalesAgent> = {}): SalesAgent {
  return {
    id: 'ia-1', name: 'IA de teste', enabled: true, mode: 'seller', trigger_keyword: null,
    persona_role: 'corretora de teste', persona_goal: null, instructions: 'Seja breve.', greeting: null,
    qualification_questions: ['Renda', 'Quartos'],
    transfer_config: { mode: 'checklist', required_questions: ['Renda'], voice: 'first_person' },
    handoff_message: null, model: 'claude-sonnet-4-5-20250929', temperature: 0.4, max_context_tokens: 4000,
    reply_delay_seconds: 10, inbox_id: 'inbox-1', inbox_name: 'Número de teste', pipeline_id: null, stage_id: null,
    active_hours: { mode: 'always', tz: 'America/Sao_Paulo' }, triggers: [], trigger_match_mode: 'any',
    bant_config: { enabled: false }, usage_limits: {}, followup_enabled: true, followup_only: false,
    followup_min_days: 2, followup_max_days: 3, followup_max_attempts: 3, followup_action: 'sequence',
    followup_stage_id: null, followup_return_stage_id: null, followup_sequence_slug: null, followup_flow_id: 'fu-padrao',
    followup_drip_enabled: true, followup_drip_min_leads: 2, followup_drip_max_leads: 3,
    followup_drip_min_minutes: 3, followup_drip_max_minutes: 5, followup_pipeline_ids: [],
    reengagement_enabled: false, reengagement_first_hours: 2, reengagement_second_hours: 8,
    handoff_target: 'user', handoff_roleta_config_id: null, handoff_user_id: 'user-9',
    audio_enabled: false, audio_mode: 'mirror', audio_voice_id: null, sales_method: 'consultative', social_proof: null,
    booking_enabled: true, visit_duration_minutes: 60, example_conversations: [], locacao_enabled: true,
    escalate_on_frustration: true, escalate_on_human_request: true, escalate_on_ai_detected: true,
    ai_limits: { address: true }, crm_policy: { cold: false, capture: false, invalid: true },
    ask_google_review: false, google_review_link: null, cross_sell_enabled: true, rich_media_enabled: true,
    visit_config: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', min_advance_hours: 24, max_advance_days: 30, blocked_dates: [], avoid_double_booking: true, same_day_requires_human: true },
    default_property_code: null, default_origin: null, intent_question: null, opening_image_url: null,
    intent_paths_default: [
      { nome: 'Moradia', como: 'Descubra pra quem é, quartos, região e prazo.' },
      { nome: 'Investimento', como: 'Foque em valorização, renda e entrada.' },
      { nome: 'Sondando', como: 'Sem pressão: entenda o momento e deixe a porta aberta.' },
    ],
    opening_audio_url: null, openings: [], playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'] } }, priority: 0,
    followup_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5, 6] }] },
    out_of_hours_reply: false, out_of_hours_message: null, catalog_search_enabled: true,
    message_split_enabled: true, message_split_max_parts: 3, pipeline_move_enabled: false, pipeline_stage_map: {},
    send_property_book_enabled: true, book_send_rule: null, reaction_enabled: false, reaction_emojis: ['👍'],
    reaction_max_per_conversation: 3,
    persona_kind: 'broker', reach: 'visit', lead_facing_name: null, tone: null, emoji_use: null,
    number_owner_id: 'user-7', number_owner_name: 'Dona do número',
    documents_count: 0, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-10-05T10:00:00Z',
    ...extra,
  } as SalesAgent;
}
