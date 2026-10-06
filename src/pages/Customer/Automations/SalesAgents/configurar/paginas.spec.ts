import { describe, expect, it } from 'vitest';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import {
  GRUPOS_DE_PAGINAS, ORDEM_DAS_PAGINAS, PAGINAS, agendamentoTravado, conferirCamposDaPagina, paginaDaUrl, paginaInicial,
} from './paginas';
import { CAMPOS_ESCONDIDOS, RAIZES_DIVIDIDAS } from './camposDaIa';

const todos = () => ORDEM_DAS_PAGINAS.flatMap((p) => [...PAGINAS[p].campos]);

describe('paginas', () => {
  it('5 grupos, 15 páginas, na ordem da conversa (spec §3)', () => {
    expect(GRUPOS_DE_PAGINAS.map((g) => g.rotulo)).toEqual(['Atendimento', 'Introdução', 'Conversa', 'Repasse', 'Follow-up']);
    expect(ORDEM_DAS_PAGINAS).toEqual([
      'canal', 'horario', 'identidade', 'abertura', 'intencao', 'personalidade', 'qualificacao', 'catalogo',
      'restricoes', 'objetivo', 'criterio', 'destino', 'funil', 'agendamento', 'followup',
    ]);
  });

  it('nenhuma página grava o que saiu da tela', () => {
    const escondidos: readonly string[] = CAMPOS_ESCONDIDOS;
    todos().forEach((c) => expect(escondidos.some((e) => c === e || c.startsWith(`${e}.`))).toBe(false));
  });

  it('jsonb dividido só entra por subchave', () => {
    const divididas: readonly string[] = RAIZES_DIVIDIDAS;
    todos().forEach((c) => expect(divididas.includes(c)).toBe(false));
  });

  // Tudo o que o passo a passo gravava (menos o que saiu da tela) tem página.
  it('nada do passo a passo ficou sem página', () => {
    const antes = [
      'name', 'persona_kind', 'lead_facing_name', 'transfer_config.voice', 'handoff_target', 'handoff_roleta_config_id',
      'handoff_user_id', 'reaction_enabled', 'reaction_emojis', 'reaction_max_per_conversation', 'reach', 'booking_enabled',
      'handoff_webhook_url', 'transfer_config.mode', 'transfer_config.min_temperature', 'transfer_config.briefing_enabled',
      'pipeline_move_enabled', 'pipeline_id', 'pipeline_stage_map', 'crm_policy.cold', 'ask_google_review', 'google_review_link',
      'greeting', 'intent_question', 'playbook.intent_question_mode', 'default_origin', 'opening_image_url', 'opening_audio_url',
      'openings', 'qualification_questions', 'transfer_config.required_questions', 'ai_limits.address', 'ai_limits.discount',
      'ai_limits.price', 'ai_limits.iptu', 'ai_limits.custom', 'visit_duration_minutes', 'visit_config.days', 'visit_config.start',
      'visit_config.end', 'visit_config.min_advance_hours', 'visit_config.max_advance_days', 'visit_config.same_day_requires_human',
      'visit_config.avoid_double_booking', 'locacao_enabled', 'playbook.vars.tipo_venda', 'default_property_code',
      'catalog_search_enabled', 'cross_sell_enabled', 'rich_media_enabled', 'send_property_book_enabled', 'book_send_rule',
      'inbox_id', 'triggers', 'trigger_match_mode', 'trigger_keyword', 'active_hours', 'out_of_hours_reply', 'out_of_hours_message',
      'message_split_enabled', 'audio_enabled', 'audio_mode', 'audio_voice_id', 'followup_enabled', 'followup_only',
      'followup_min_days', 'followup_max_days', 'followup_action', 'followup_stage_id', 'followup_return_stage_id',
      'followup_flow_id', 'followup_pipeline_ids', 'followup_hours', 'reengagement_enabled', 'reengagement_first_hours',
      'reengagement_second_hours',
    ];
    const agora = new Set(todos());
    expect(antes.filter((c) => !agora.has(c))).toEqual([]);
  });

  it('?passo= antigo vira página; ?pagina= desconhecida é ignorada', () => {
    expect(paginaDaUrl(new URLSearchParams('pagina=destino'))).toBe('destino');
    expect(paginaDaUrl(new URLSearchParams('passo=3'))).toBe('abertura');
    expect(paginaDaUrl(new URLSearchParams('passo=6'))).toBe('canal');
    expect(paginaDaUrl(new URLSearchParams('passo=7'))).toBe('followup');
    expect(paginaDaUrl(new URLSearchParams('pagina=xyz'))).toBeNull();
    expect(paginaDaUrl(new URLSearchParams(''))).toBeNull();
    for (const q of ['pagina=constructor', 'pagina=__proto__', 'pagina=toString', 'passo=constructor', 'passo=__proto__']) {
      expect(paginaDaUrl(new URLSearchParams(q))).toBeNull();
    }
  });

  it('abre na primeira página com pendência, senão em Canal', () => {
    expect(paginaInicial(agenteDeTeste({ lead_facing_name: 'Bia', inbox_id: null }))).toBe('canal');
    expect(paginaInicial(agenteDeTeste({ lead_facing_name: null }))).toBe('identidade');
    expect(paginaInicial(agenteDeTeste({ lead_facing_name: 'Bia', persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1', transfer_config: { mode: 'checklist', required_questions: ['Renda'] } }))).toBe('canal');
  });

  it('Agendamento trava quando o objetivo não é visita', () => {
    expect(agendamentoTravado(agenteDeTeste({ reach: 'qualify' }))).toBe(true);
    expect(agendamentoTravado(agenteDeTeste({ reach: 'visit' }))).toBe(false);
  });

  it('a página só grava os campos dela', () => {
    expect(() => conferirCamposDaPagina('canal', ['inbox_id'])).not.toThrow();
    expect(() => conferirCamposDaPagina('canal', ['greeting'])).toThrow(/greeting/);
  });
});
