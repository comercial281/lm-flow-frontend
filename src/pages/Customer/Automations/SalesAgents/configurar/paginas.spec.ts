import { describe, expect, it } from 'vitest';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import {
  ORDEM_DAS_PAGINAS, PAGINAS, PAGINA_ANTIGA, PASSO_PARA_PAGINA, agendamentoTravado, conferirCamposDaPagina, paginaDaUrl, paginaInicial, vizinhas,
  type PaginaId,
} from './paginas';
import { CAMPOS_DE_ENSINAR, CAMPOS_ESCONDIDOS, RAIZES_DIVIDIDAS } from './camposDaIa';
import { camposDaMudanca } from './useGravarNaHora';

const todos = () => ORDEM_DAS_PAGINAS.flatMap((p) => [...PAGINAS[p].campos]);
const daUrl = (q: string) => paginaDaUrl(new URLSearchParams(q));

describe('paginas (Configurar em 8 páginas)', () => {
  it('8 páginas, na ordem da tela 3 do protótipo, com título e frase', () => {
    expect(ORDEM_DAS_PAGINAS).toEqual(['modo', 'numeros', 'publico', 'campanhas', 'conducao', 'materiais', 'destino', 'funil']);
    expect(ORDEM_DAS_PAGINAS.map((p) => PAGINAS[p].titulo)).toEqual([
      'Modo operante', 'Números e usuários', 'Público-alvo e produto', 'Campanhas e gatilhos', 'Condução', 'Materiais', 'Destino', 'Funil e follow-up',
    ]);
    expect(PAGINAS.modo.frase).toBe('O que ela faz, o que oferece no fim e quando passa o lead antes da hora.');
    expect(PAGINAS.funil.frase).toBe('Onde o card fica em cada momento e o que ela faz quando o lead some.');
    ORDEM_DAS_PAGINAS.forEach((p) => {
      expect(PAGINAS[p].id).toBe(p);
      expect(PAGINAS[p].frase).not.toMatch(/[—–]/);
      expect(PAGINAS[p].titulo).not.toMatch(/[—–]/);
    });
  });

  it('os campos de cada página (enunciado da Tarefa 70)', () => {
    expect(PAGINAS.modo.campos).toEqual(expect.arrayContaining(['job', 'next_steps', 'handoff_exceptions', 'house_voice.office_address', 'visit_config.days', 'visit_duration_minutes', 'playbook.vars.lead_pronto']));
    expect([...PAGINAS.numeros.campos].sort()).toEqual([
      'active_hours', 'house_voice.gender', 'house_voice.intro', 'house_voice.kind', 'house_voice.name', 'out_of_hours_message', 'out_of_hours_reply',
    ]);
    expect([...PAGINAS.publico.campos].sort()).toEqual([
      'catalog_search_enabled', 'cross_sell_enabled', 'default_property_code', 'intent_question', 'playbook.intent_question_mode',
      'playbook.vars.caminhos_intencao', 'playbook.vars.fora_dos_caminhos', 'serves',
    ]);
    expect([...PAGINAS.campanhas.campos].sort()).toEqual(['openings', 'trigger_keyword', 'trigger_match_mode', 'triggers']);
    expect(PAGINAS.conducao.campos).toContain('greeting');
    expect(PAGINAS.conducao.campos).not.toContain('openings');
    expect(PAGINAS.conducao.campos).toEqual(expect.arrayContaining(['qualification_questions', 'transfer_config.required_questions', 'message_split_enabled', 'ai_limits.custom']));
    expect([...PAGINAS.materiais.campos].sort()).toEqual(['book_send_rule', 'location_pin_enabled', 'rich_media_enabled', 'send_property_book_enabled']);
    expect(PAGINAS.destino.campos).toEqual(expect.arrayContaining(['handoff_continue_at', 'handoff_service_inbox_id', 'handoff_arrival_message', 'handoff_target']));
    expect(PAGINAS.destino.campos).not.toContain('persona_kind');
    expect(PAGINAS.funil.campos).toEqual(expect.arrayContaining(['pipeline_stage_map', 'followup_enabled', 'followup_only', 'reengagement_second_hours']));
  });

  it('nenhuma página grava o que saiu da tela', () => {
    const escondidos: readonly string[] = CAMPOS_ESCONDIDOS;
    todos().forEach((c) => expect(escondidos.some((e) => c === e || c.startsWith(`${e}.`)), c).toBe(false));
  });

  it('o que o enunciado esconde está escondido', () => {
    const escondidos: readonly string[] = CAMPOS_ESCONDIDOS;
    ['persona_kind', 'lead_facing_name', 'transfer_config.voice', 'transfer_config.mode', 'transfer_config.min_temperature',
      'transfer_config.early_handoff', 'crm_policy.cold', 'reach', 'booking_enabled', 'escalate_on_frustration', 'escalate_on_human_request',
      'escalate_on_ai_detected', 'locacao_enabled', 'playbook.vars.tipo_venda', 'instructions', 'inbox_id']
      .forEach((c) => expect(escondidos, c).toContain(c));
    expect([...CAMPOS_DE_ENSINAR]).toEqual(['house_rules', 'house_objections', 'factory_knowledge_off', 'social_proof', 'example_conversations']);
  });

  it('jsonb dividido só entra por subchave; house_voice também', () => {
    const divididas: readonly string[] = RAIZES_DIVIDIDAS;
    expect(divididas).toContain('house_voice');
    todos().forEach((c) => expect(divididas.includes(c), c).toBe(false));
    expect(() => camposDaMudanca({ house_voice: { name: 'Ana' } })).toThrow(/house_voice/);
    expect(camposDaMudanca({ house_voice: { name: 'Ana' } }, ['house_voice.name'])).toEqual(['house_voice.name']);
  });

  it('campo escondido nunca é gravado, mesmo que o agente traga o valor', () => {
    expect(() => camposDaMudanca({ persona_kind: 'broker' })).toThrow(/saiu da tela/);
    expect(() => camposDaMudanca({ inbox_id: 'inbox-2' })).toThrow(/saiu da tela/);
    expect(() => camposDaMudanca({ transfer_config: {} }, ['transfer_config.mode'])).toThrow(/saiu da tela/);
    expect(() => conferirCamposDaPagina('modo', ['reach'])).toThrow(/reach/);
  });

  it('cada ?pagina= antigo cai na página nova (seção 3 da spec)', () => {
    const esperado: Record<string, PaginaId> = {
      canal: 'numeros', horario: 'numeros', identidade: 'numeros',
      abertura: 'conducao', personalidade: 'conducao', qualificacao: 'conducao', restricoes: 'conducao',
      intencao: 'publico', catalogo: 'publico',
      objetivo: 'modo', criterio: 'modo', agendamento: 'modo',
      followup: 'funil', destino: 'destino', funil: 'funil',
    };
    Object.entries(esperado).forEach(([antiga, nova]) => {
      expect(PAGINA_ANTIGA[antiga], antiga).toBe(nova);
      expect(daUrl(`pagina=${antiga}`), antiga).toBe(nova);
    });
    ORDEM_DAS_PAGINAS.forEach((p) => expect(daUrl(`pagina=${p}`)).toBe(p));
  });

  it('?passo=1..8 cai na página nova', () => {
    expect(PASSO_PARA_PAGINA).toEqual({ 1: 'numeros', 2: 'modo', 3: 'conducao', 4: 'modo', 5: 'publico', 6: 'numeros', 7: 'funil', 8: 'numeros' });
    for (let n = 1; n <= 8; n += 1) expect(daUrl(`passo=${n}`), `passo ${n}`).toBe(PASSO_PARA_PAGINA[n]);
  });

  it('página desconhecida e nome da cadeia do objeto dão nulo', () => {
    expect(daUrl('pagina=xyz')).toBeNull();
    expect(daUrl('')).toBeNull();
    for (const q of ['pagina=constructor', 'pagina=__proto__', 'pagina=toString', 'passo=constructor', 'passo=__proto__', 'passo=0', 'passo=9']) {
      expect(daUrl(q), q).toBeNull();
    }
  });

  it('vizinhas: a primeira não tem anterior e a última não tem próxima', () => {
    expect(vizinhas('modo')).toEqual({ anterior: null, proxima: 'numeros' });
    expect(vizinhas('conducao')).toEqual({ anterior: 'campanhas', proxima: 'materiais' });
    expect(vizinhas('funil')).toEqual({ anterior: 'destino', proxima: null });
  });

  it('abre na primeira página com pendência, senão em Modo operante', () => {
    expect(paginaInicial(agenteDeTeste({ lead_facing_name: 'Bia', inbox_id: null }))).toBe('numeros');
    expect(paginaInicial(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1' }))).toBe('modo');
    expect(paginaInicial(agenteDeTeste({ persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: null }))).toBe('destino');
  });

  it('a agenda só trava quando o trabalho não é Leva até a visita', () => {
    expect(agendamentoTravado(agenteDeTeste({ reach: 'qualify', job: 'filtra_passa' }))).toBe(true);
    expect(agendamentoTravado(agenteDeTeste({ reach: 'visit', job: 'leva_visita' }))).toBe(false);
  });

  it('a página só grava os campos dela', () => {
    expect(() => conferirCamposDaPagina('numeros', ['active_hours'])).not.toThrow();
    expect(() => conferirCamposDaPagina('numeros', ['greeting'])).toThrow(/greeting/);
  });
});
