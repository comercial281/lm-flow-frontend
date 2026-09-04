import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import {
  answersFromAgent,
  instrucoesDeReserva,
  payloadFromAnswers,
  playbookDasRespostas,
  type AssistenteAnswers,
} from './assistenteMapping';

// Uma IA recém-criada pelo "+": tudo em branco, desligada, com as quatro
// perguntas de fábrica. É o caso mais comum de entrada no assistente.
function iaNova(extra: Partial<SalesAgent> = {}): SalesAgent {
  return {
    id: 'ia-1',
    name: 'Nova IA Vendedora',
    enabled: false,
    mode: 'seller',
    trigger_keyword: null,
    persona_role: null,
    persona_goal: null,
    instructions: null,
    greeting: null,
    qualification_questions: ['Orçamento', 'Prazo de compra', 'Região de interesse', 'Precisa de financiamento'],
    transfer_config: {},
    handoff_message: null,
    model: 'claude',
    temperature: 0.7,
    max_context_tokens: 4000,
    reply_delay_seconds: 10,
    inbox_id: null,
    inbox_name: null,
    pipeline_id: null,
    stage_id: null,
    active_hours: {},
    triggers: [],
    trigger_match_mode: 'any',
    bant_config: {},
    usage_limits: {},
    followup_enabled: false,
    followup_only: false,
    followup_min_days: 2,
    followup_max_days: 3,
    followup_max_attempts: 3,
    followup_action: 'ai',
    followup_stage_id: null,
    followup_return_stage_id: null,
    followup_sequence_slug: null,
    followup_drip_enabled: true,
    followup_drip_min_leads: 2,
    followup_drip_max_leads: 3,
    followup_drip_min_minutes: 3,
    followup_drip_max_minutes: 5,
    audio_enabled: false,
    audio_mode: 'mirror',
    audio_voice_id: null,
    sales_method: 'consultative',
    social_proof: null,
    booking_enabled: true,
    visit_duration_minutes: 60,
    example_conversations: [],
    locacao_enabled: true,
    escalate_on_frustration: true,
    escalate_on_human_request: true,
    escalate_on_ai_detected: true,
    ai_limits: {},
    crm_policy: {},
    ask_google_review: false,
    google_review_link: null,
    cross_sell_enabled: false,
    rich_media_enabled: true,
    visit_config: {},
    default_property_code: null,
    default_origin: null,
    intent_question: null,
    opening_image_url: null,
    opening_audio_url: null,
    openings: [],
    priority: 0,
    followup_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5, 6] }] },
    out_of_hours_reply: false,
    out_of_hours_message: null,
    catalog_search_enabled: false,
    message_split_enabled: true,
    message_split_max_parts: 3,
    documents_count: 0,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...extra,
  };
}

describe('assistente da IA: respostas → PATCH', () => {
  it('IA nova com tudo em branco não grava NADA', () => {
    const agent = iaNova();
    const respostas = answersFromAgent(agent, null);
    expect(payloadFromAnswers(respostas, agent)).toEqual({});
  });

  // Tipo de venda "lançamento" e próximo passo "visita" são o padrão de fábrica.
  // Gravá-los faria a seção Roteiro mostrar "escolhido" onde nada foi escolhido.
  it('tipo de venda e próximo passo no padrão de fábrica não viram pontos-chave', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      tipo_venda: 'lancamento',
      proximo_passo: 'visita',
    };
    expect(payloadFromAnswers(respostas, agent)).toEqual({});
  });

  it('tipo de venda diferente entra em playbook.vars, e o termo do tipo NÃO é gravado', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      tipo_venda: 'usado',
      termo_imovel: 'IMÓVEL', // é o padrão de "usado": o servidor já escolhe
    };
    const patch = payloadFromAnswers(respostas, agent);
    expect(patch.playbook).toEqual({ vars: { tipo_venda: 'usado' } });
  });

  it('termo do imóvel diferente do padrão do tipo grava o vocabulário', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      tipo_venda: 'loteamento',
      termo_imovel: 'terreno',
    };
    expect(payloadFromAnswers(respostas, agent).playbook).toEqual({
      vars: { tipo_venda: 'loteamento' },
      vocabulary: 'TERRENO',
    });
  });

  // Mandar só `vars` apagaria os blocos reescritos na seção Roteiro da conversa.
  it('o playbook vai INTEIRO: bloco reescrito antes atravessa o assistente intacto', () => {
    const agent = iaNova({
      playbook: { opening_structure: 'ABERTURA reescrita pelo gestor', intent_question_mode: 'never' },
    });
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      dor_tipica: 'aluguel caro',
    };
    const patch = payloadFromAnswers(respostas, agent);
    expect(patch.playbook).toEqual({
      opening_structure: 'ABERTURA reescrita pelo gestor',
      intent_question_mode: 'never',
      vars: { dor_tipica: 'aluguel caro' },
    });
  });

  it('objeção pela metade é descartada; par completo entra limpo', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      objecoes: [
        { objecao: 'Tá caro', resposta: '' },
        { objecao: '', resposta: 'sem objeção' },
        { objecao: '  Vou pensar  ', resposta: ' Combinamos a visita sem compromisso ' },
      ],
    };
    expect(payloadFromAnswers(respostas, agent).playbook).toEqual({
      vars: { objecoes: [{ objecao: 'Vou pensar', resposta: 'Combinamos a visita sem compromisso' }] },
    });
  });

  it('pergunta de intenção "sempre" não grava o modo; "nunca" grava', () => {
    expect(playbookDasRespostas({ ...answersFromAgent(iaNova(), null), intent_question_mode: 'always' }, {})).toEqual({});
    expect(playbookDasRespostas({ ...answersFromAgent(iaNova(), null), intent_question_mode: 'never' }, {})).toEqual({
      intent_question_mode: 'never',
    });
  });

  // Quem abre uma IA já configurada e limpa a saudação quer a saudação fora.
  it('apagar um texto que existia grava null; deixar igual não grava', () => {
    const agent = iaNova({ greeting: 'Oi! Sou a Bia.', persona_role: 'Consultora' });
    const respostas: AssistenteAnswers = { ...answersFromAgent(agent, null), greeting: '   ' };
    const patch = payloadFromAnswers(respostas, agent);
    expect(patch.greeting).toBeNull();
    expect('persona_role' in patch).toBe(false);
  });

  it('o que a pessoa contou da imobiliária vira Instruções quando ela não escreveu nenhuma', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      nome_imobiliaria: 'Aurora Imóveis',
      o_que_vende: 'apartamentos de 2 e 3 quartos na zona sul',
      tom: 'próxima e direta',
      usa_emoji: true,
    };
    const patch = payloadFromAnswers(respostas, agent);
    expect(patch.instructions).toBe(instrucoesDeReserva(respostas));
    expect(patch.instructions).toContain('Aurora Imóveis');
    expect(patch.instructions).toContain('emoji');
  });

  it('as escolhas de destino do follow-up viajam como null quando limpas', () => {
    const agent = iaNova({ followup_action: 'pipeline', followup_stage_id: 'col-1', pipeline_id: 'pipe-1' });
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      followup_stage_id: '',
    };
    const patch = payloadFromAnswers(respostas, agent);
    expect(patch.followup_stage_id).toBeNull();
    expect('pipeline_id' in patch).toBe(false);
  });

  it('horário de atuação por janela grava mode custom com fuso explícito', () => {
    const agent = iaNova();
    const respostas: AssistenteAnswers = {
      ...answersFromAgent(agent, null),
      atuacao_sempre: false,
      atuacao_janelas: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }],
    };
    expect(payloadFromAnswers(respostas, agent).active_hours).toEqual({
      tz: 'America/Sao_Paulo',
      mode: 'custom',
      windows: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }],
    });
  });

  it('o horário do follow-up só viaja quando muda, e vai resolvido com fuso', () => {
    const agent = iaNova();
    const iguais = answersFromAgent(agent, null);
    expect('followup_hours' in payloadFromAnswers(iguais, agent)).toBe(false);

    const mudou: AssistenteAnswers = { ...iguais, followup_janelas: [{ start: '10:00', end: '16:00', days: [1, 2, 3] }] };
    expect(payloadFromAnswers(mudou, agent).followup_hours).toEqual({
      mode: 'custom',
      tz: 'America/Sao_Paulo',
      windows: [{ start: '10:00', end: '16:00', days: [1, 2, 3] }],
    });
  });

  it('cenário de repasse "temperatura" leva a temperatura mínima; os outros não', () => {
    const agent = iaNova();
    const base = answersFromAgent(agent, null);
    expect(payloadFromAnswers({ ...base, handoff_mode: 'temperatura', min_temperature: 'warm' }, agent).transfer_config)
      .toEqual({ mode: 'temperatura', min_temperature: 'warm' });
    expect(payloadFromAnswers({ ...base, handoff_mode: 'duvida', min_temperature: 'warm' }, agent).transfer_config)
      .toEqual({ mode: 'duvida' });
  });

  it('abre preenchido com o que a IA já tem, pontos-chave vindos do endpoint do roteiro', () => {
    // O agente carrega o mesmo `playbook` que o endpoint do roteiro resolve — os
    // dois vêm do mesmo campo no servidor.
    const vars = { tipo_venda: 'usado', perguntas_situacao: ['Onde você mora hoje?'], objecoes: [{ objecao: 'x', resposta: 'y' }] };
    const agent = iaNova({
      name: 'Bia', greeting: 'Oi!', locacao_enabled: false, ai_limits: { address: true, custom: ['Não fala de vaga'] },
      playbook: { intent_question_mode: 'opening_only', vars },
    });
    const respostas = answersFromAgent(agent, {
      intent_question_mode: 'opening_only',
      intent_question_modes: ['always', 'opening_only', 'never'],
      vars,
      slot_defaults: { tipo_venda: '', perguntas_situacao: '', dor_tipica: '', lead_pronto: '', proximo_passo: '', objecoes: [] },
      var_labels: {},
      var_hints: {},
      sale_types: [],
      next_steps: [],
      blocks: [],
    });
    expect(respostas.nome_ia).toBe('Bia');
    expect(respostas.greeting).toBe('Oi!');
    expect(respostas.locacao_enabled).toBe(false);
    expect(respostas.limite_endereco).toBe(true);
    expect(respostas.limites_livres).toEqual(['Não fala de vaga']);
    expect(respostas.intent_question_mode).toBe('opening_only');
    expect(respostas.tipo_venda).toBe('usado');
    expect(respostas.termo_imovel).toBe('IMÓVEL');
    expect(respostas.perguntas_situacao).toEqual(['Onde você mora hoje?']);
    expect(respostas.objecoes).toEqual([{ objecao: 'x', resposta: 'y' }]);
    // E reabrir sem mexer não grava nada.
    expect(payloadFromAnswers(respostas, agent)).toEqual({});
  });
});
