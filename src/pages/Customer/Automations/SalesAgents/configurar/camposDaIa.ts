/**
 * As listas de campo que valem pra TODA a IA (onda 3, 06/10/2026). Os campos que
 * cada página grava moram em `paginas.ts` (o `CAMPOS_DO_PASSO` do passo a passo saiu).
 *
 * ⚠️ jsonb dividido (`RAIZES_DIVIDIDAS`) só entra por SUBCHAVE, e o que está em
 * `CAMPOS_ESCONDIDOS` nenhuma página grava: o `useGravarNaHora` recusa os dois.
 */

/** Ensinar (instruções, prova social, exemplos): saiu do Configurar e mora lá. */
export const CAMPOS_DE_ENSINAR = ['instructions', 'social_proof', 'example_conversations'] as const;

/**
 * Saíram da tela e NUNCA podem ser gravados por uma página (ficam no banco).
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
] as const;

/** jsonb que mais de um passo (ou algo escondido) divide: só entram por subchave. */
export const RAIZES_DIVIDIDAS = ['transfer_config', 'crm_policy', 'ai_limits', 'visit_config', 'playbook', 'usage_limits'] as const;
