/**
 * Os campos que CADA passo grava (ver features/salesAgents/patchDoPasso.ts).
 *
 * ⚠️ Campo novo na tela entra AQUI, no passo dele, ou a tela mostra e o Salvar
 * nunca manda — a mesma cicatriz do `saveAgent`, agora com spec
 * (camposDosPassos.spec.ts). jsonb dividido entre passos entra por SUBCHAVE.
 *
 * ⚠️ O destino (`handoff_*`) está no passo 1 E no 2: trocar a persona trava ou
 * destrava o dono do número, e o servidor recusa persona corretor sem ele.
 */
export const CAMPOS_DO_PASSO = {
  1: ['name', 'persona_kind', 'lead_facing_name', 'transfer_config.voice',
    'handoff_target', 'handoff_roleta_config_id', 'handoff_user_id',
    'reaction_enabled', 'reaction_emojis', 'reaction_max_per_conversation'],
  2: ['reach', 'booking_enabled', 'persona_kind', 'handoff_target', 'handoff_roleta_config_id', 'handoff_user_id', 'handoff_webhook_url',
    'transfer_config.mode', 'transfer_config.min_temperature', 'transfer_config.briefing_enabled',
    'pipeline_move_enabled', 'pipeline_id', 'pipeline_stage_map', 'crm_policy.cold', 'crm_policy.capture',
    'ask_google_review', 'google_review_link'],
  3: ['greeting', 'intent_question', 'playbook.intent_question_mode', 'default_origin', 'opening_image_url',
    'opening_audio_url', 'openings', 'qualification_questions', 'transfer_config.required_questions',
    'ai_limits.address', 'ai_limits.discount', 'ai_limits.price', 'ai_limits.iptu', 'ai_limits.custom'],
  4: ['visit_duration_minutes', 'visit_config.days', 'visit_config.start', 'visit_config.end',
    'visit_config.min_advance_hours', 'visit_config.max_advance_days', 'visit_config.same_day_requires_human',
    'visit_config.avoid_double_booking'],
  5: ['locacao_enabled', 'playbook.vars.tipo_venda', 'default_property_code', 'catalog_search_enabled',
    'cross_sell_enabled', 'rich_media_enabled', 'send_property_book_enabled', 'book_send_rule'],
  6: ['inbox_id', 'triggers', 'trigger_match_mode', 'trigger_keyword', 'active_hours', 'out_of_hours_reply',
    'out_of_hours_message', 'message_split_enabled', 'audio_enabled', 'audio_mode', 'audio_voice_id'],
  7: ['followup_enabled', 'followup_only', 'followup_min_days', 'followup_max_days',
    'followup_action', 'followup_stage_id', 'followup_return_stage_id', 'followup_sequence_slug', 'followup_flow_id',
    'followup_pipeline_ids', 'followup_hours', 'reengagement_enabled', 'reengagement_first_hours',
    'reengagement_second_hours'],
  avancado: ['model', 'max_context_tokens', 'priority', 'reply_delay_seconds', 'message_split_max_parts',
    'followup_drip_enabled', 'followup_drip_min_leads', 'followup_drip_max_leads', 'followup_drip_min_minutes',
    'followup_drip_max_minutes', 'usage_limits.max_new_leads_per_day', 'usage_limits.max_active_conversations'],
} as const satisfies Record<string, readonly string[]>;

/** Ensinar (instruções, prova social, exemplos): saiu do Configurar e mora lá. */
export const CAMPOS_DE_ENSINAR = ['instructions', 'social_proof', 'example_conversations'] as const;

/** Saíram da tela na entrega 2 e NUNCA podem ser gravados por um passo (ficam no banco). */
export const CAMPOS_ESCONDIDOS = [
  'mode', 'persona_role', 'persona_goal', 'sales_method', 'bant_config', 'handoff_message', 'temperature',
  'escalate_on_frustration', 'escalate_on_human_request', 'escalate_on_ai_detected', 'crm_policy.invalid',
  'visit_config.blocked_dates', 'playbook.vocabulary', 'playbook.vars.proximo_passo',
  'playbook.vars.perguntas_situacao', 'playbook.vars.dor_tipica', 'playbook.vars.lead_pronto',
  'playbook.vars.objecoes', 'usage_limits.daily_budget_usd', 'test_model', 'max_output_tokens', 'enabled',
  // Tom e emoji existem desde a entrega 2, mas o controle só entra no passo 1 na
  // entrega 4 (no v1 a opção não faria nada). Sair daqui é o primeiro passo de lá.
  'tone', 'emoji_use',
  // Saiu do passo 7 em 06/10/2026: a IA não escreve mais o follow-up, só entrega o
  // lead uma vez por sumiço, e o teto de tentativas deixou de ter o que contar.
  'followup_max_attempts',
] as const;

/** jsonb que mais de um passo (ou algo escondido) divide: só entram por subchave. */
export const RAIZES_DIVIDIDAS = ['transfer_config', 'crm_policy', 'ai_limits', 'visit_config', 'playbook', 'usage_limits'] as const;
