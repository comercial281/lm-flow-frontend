/**
 * As listas de campo que valem pra TODA a IA (onda 3, 06/10/2026). Os campos que
 * cada página grava moram em `paginas.ts` (o `CAMPOS_DO_PASSO` do passo a passo saiu).
 *
 * ⚠️ jsonb dividido (`RAIZES_DIVIDIDAS`) só entra por SUBCHAVE, e o que está em
 * `CAMPOS_ESCONDIDOS` nenhuma página grava: o `useGravarNaHora` recusa os dois.
 */

/**
 * Ensinar: gravados na hora pelas páginas do Ensinar. Desde a Tarefa 70 (01/11/2026) as
 * Instruções saíram (`instructions` virou escondido): no lugar entram as regras e
 * objeções da casa, os conhecimentos de fábrica desligados, a prova social e os exemplos.
 */
export const CAMPOS_DE_ENSINAR = ['house_rules', 'house_objections', 'factory_knowledge_off', 'social_proof', 'example_conversations'] as const;

/**
 * Saíram da tela e NUNCA podem ser gravados por uma página (ficam no banco).
 *
 * Mudou em 01/11/2026 (Tarefa 70, Configurar em 8 páginas): entraram `persona_kind`,
 * `lead_facing_name`, `transfer_config.{voice,mode,min_temperature,early_handoff}`,
 * `crm_policy.cold`, `reach`, `booking_enabled`, `escalate_on_*`, `locacao_enabled`,
 * `playbook.vars.tipo_venda`, `instructions` e `inbox_id`: o trabalho (`job`), a ficha de
 * quem fala (`house_voice`) e os números do agente (API própria) tomaram o lugar deles. O
 * agente pode até trazer o valor; a tela nunca grava.
 *
 * Mudou em 06/10/2026 (onda 3): `escalate_on_*` voltaram pra tela (Critério →
 * Passagem imediata) e `playbook.vars.lead_pronto` também (Agendamento → Quando
 * propor). Entraram `crm_policy.capture` ("captação", morto: o servidor não lê) e
 * `followup_sequence_slug` (funil antigo; só o aviso do follow-up o mostra).
 */
export const CAMPOS_ESCONDIDOS = [
  'mode', 'persona_role', 'persona_goal', 'sales_method', 'bant_config', 'handoff_message', 'temperature',
  'crm_policy.invalid', 'crm_policy.capture', 'visit_config.blocked_dates', 'playbook.vocabulary',
  'playbook.vars.proximo_passo', 'playbook.vars.perguntas_situacao', 'playbook.vars.dor_tipica',
  'playbook.vars.objecoes', 'usage_limits.daily_budget_usd', 'test_model', 'max_output_tokens', 'enabled',
  'tone', 'emoji_use', 'followup_max_attempts', 'followup_sequence_slug',
  'persona_kind', 'lead_facing_name', 'transfer_config.voice', 'transfer_config.mode', 'transfer_config.min_temperature',
  'transfer_config.early_handoff', 'crm_policy.cold', 'reach', 'booking_enabled', 'escalate_on_frustration',
  'escalate_on_human_request', 'escalate_on_ai_detected', 'locacao_enabled', 'playbook.vars.tipo_venda', 'instructions', 'inbox_id',
] as const;

/** jsonb que mais de um passo (ou algo escondido) divide: só entram por subchave. */
export const RAIZES_DIVIDIDAS = ['transfer_config', 'crm_policy', 'ai_limits', 'visit_config', 'playbook', 'usage_limits', 'house_voice'] as const;
