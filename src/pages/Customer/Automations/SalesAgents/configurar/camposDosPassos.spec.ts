import { describe, expect, it } from 'vitest';
import { CAMPOS_DE_ENSINAR, CAMPOS_DO_PASSO, CAMPOS_ESCONDIDOS, RAIZES_DIVIDIDAS } from './camposDosPassos';

// Cada campo que o passo a passo edita tem UM dono (salvo os do destino, que o
// passo 1 também grava ao trocar a persona), e o que saiu da tela não é dono de
// ninguém: é assim que ele nunca é zerado.
const todos = Object.entries(CAMPOS_DO_PASSO).flatMap(([passo, campos]) => campos.map((c) => [passo, c] as const));
const raizDe = (c: string) => c.split('.')[0];

describe('campos de cada passo', () => {
  it.each([
    ['1', 'persona_kind'], ['1', 'lead_facing_name'], ['1', 'transfer_config.voice'], ['1', 'reaction_emojis'],
    ['2', 'reach'], ['2', 'handoff_target'], ['2', 'transfer_config.mode'], ['2', 'transfer_config.briefing_enabled'],
    ['2', 'crm_policy.cold'], ['2', 'ask_google_review'], ['2', 'pipeline_stage_map'],
    ['3', 'greeting'], ['3', 'playbook.intent_question_mode'], ['3', 'openings'], ['3', 'qualification_questions'],
    ['3', 'transfer_config.required_questions'], ['3', 'ai_limits.custom'],
    ['4', 'visit_duration_minutes'], ['4', 'visit_config.same_day_requires_human'],
    ['5', 'playbook.vars.tipo_venda'], ['5', 'default_property_code'], ['5', 'book_send_rule'],
    ['6', 'inbox_id'], ['6', 'triggers'], ['6', 'trigger_keyword'], ['6', 'active_hours'], ['6', 'out_of_hours_message'], ['6', 'audio_voice_id'],
    ['7', 'reengagement_enabled'], ['7', 'followup_flow_id'], ['7', 'followup_hours'],
    ['avancado', 'model'], ['avancado', 'followup_drip_min_leads'], ['avancado', 'usage_limits.max_new_leads_per_day'],
  ])('passo %s grava %s', (passo, campo) => {
    expect(CAMPOS_DO_PASSO[passo as keyof typeof CAMPOS_DO_PASSO]).toContain(campo);
  });

  it('nenhum passo grava o que saiu da tela', () => {
    for (const [, campo] of todos) {
      for (const escondido of CAMPOS_ESCONDIDOS) {
        expect(campo === escondido || campo.startsWith(`${escondido}.`), `${campo} grava ${escondido}`).toBe(false);
        expect(campo === raizDe(escondido) && escondido.includes('.'), `${campo} levaria ${escondido} junto`).toBe(false);
      }
    }
    for (const campo of CAMPOS_DE_ENSINAR) expect(CAMPOS_ESCONDIDOS).not.toContain(campo);
  });

  it('jsonb dividido só por subchave, nunca a raiz inteira', () => {
    for (const [, campo] of todos) expect(RAIZES_DIVIDIDAS).not.toContain(campo);
  });

  // A persona também: o passo 2 a grava na conversão explícita pro dono do número.
  it('só o destino e a persona são divididos entre dois passos (1 e 2)', () => {
    const contagem = new Map<string, Set<string>>();
    for (const [passo, campo] of todos) contagem.set(campo, new Set([...(contagem.get(campo) ?? []), passo]));
    const repetidos = [...contagem].filter(([, ps]) => ps.size > 1).map(([c]) => c).sort();
    expect(repetidos).toEqual(['handoff_roleta_config_id', 'handoff_target', 'handoff_user_id', 'persona_kind']);
  });
});
