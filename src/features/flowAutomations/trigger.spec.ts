import { describe, it, expect } from 'vitest';
import { TRIGGER_LABELS } from '@/services/leadAutomation/leadAutomationService';
import {
  FLOW_TRIGGER_EVENTS,
  FLOW_TRIGGER_GROUPS,
  REMOVED_FLOW_TRIGGERS,
  changeTriggerEvent,
  flowTriggerLabel,
  normalizeTrigger,
  serializeTrigger,
  triggerProblem,
  withPipelineFilter,
  withTriggerCondition,
  addAlternative,
  updateAlternative,
  removeAlternative,
  flowTriggerSummary,
  triggerEvents,
  triggerOneLine,
  type FlowTrigger,
} from './trigger';

describe('a lista de gatilhos é a das Automações', () => {
  it('todo gatilho do fluxo existe nas Automações, com o mesmo nome na tela', () => {
    FLOW_TRIGGER_EVENTS.forEach(ev => {
      expect(TRIGGER_LABELS[ev]).toBeTruthy();
      expect(flowTriggerLabel(ev)).toBe(TRIGGER_LABELS[ev]);
    });
  });

  it('só ficam de fora os quatro que não disparam ou enganam', () => {
    const fora = Object.keys(TRIGGER_LABELS).filter(ev => !(FLOW_TRIGGER_EVENTS as string[]).includes(ev));
    expect(fora.sort()).toEqual([...REMOVED_FLOW_TRIGGERS].sort());
  });

  it('agrupados como na spec', () => {
    expect(FLOW_TRIGGER_GROUPS.map(g => g.label)).toEqual(['Lead chegou', 'Atendimento', 'Funil de vendas', 'Visita', 'Imóvel']);
  });

  it('o nome da tela não fala CTWA', () => {
    expect(flowTriggerLabel('lead.campaign_received')).toBe('Lead Whats Meta (anúncio no WhatsApp)');
  });
});

describe('o gatilho vai pro servidor como { event, conditions }', () => {
  it('com o formato de condição das regras', () => {
    const t: FlowTrigger = {
      event: 'lead.created',
      conditions: [
        { field: 'form_id', operator: 'in', value: ['f1', 'f2'] },
        { field: 'pipeline_id', operator: 'eq', value: 'p1' },
      ],
    };
    expect(serializeTrigger(t)).toEqual({
      event: 'lead.created',
      conditions: [
        { field: 'form_id', operator: 'in', value: ['f1', 'f2'] },
        { field: 'pipeline_id', operator: 'eq', value: 'p1' },
      ],
      alternatives: [],
    });
  });

  it('nada solto (stage_id, label…) e condição vazia não vai', () => {
    const out = serializeTrigger({ event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: '' }] });
    expect(out).toEqual({ event: 'lead.tag_added', conditions: [], alternatives: [] });
    // `alternatives` vai sempre (vazia apaga o último "Ou quando" tirado na tela).
    expect(Object.keys(out)).toEqual(['event', 'conditions', 'alternatives']);
  });
});

describe('leitura', () => {
  it('o formato novo passa como veio', () => {
    expect(normalizeTrigger({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }] }))
      .toEqual({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }], alternatives: [] });
  });

  it('o formato antigo é traduzido', () => {
    expect(normalizeTrigger({ event: 'contact_created' })).toEqual({ event: 'lead.created', conditions: [], alternatives: [] });
    expect(normalizeTrigger({ event: 'stage_changed', stage_id: 's1', pipeline_id: 'p1' }))
      .toEqual({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }], alternatives: [] });
    expect(normalizeTrigger({ event: 'tag_added', label: 'quente' }).conditions)
      .toEqual([{ field: 'label', operator: 'eq', value: 'quente' }]);
    expect(normalizeTrigger({ event: 'keyword', keyword: 'visita' }))
      .toMatchObject({ event: 'lead.message_received', conditions: [{ field: 'content', operator: 'contains', value: 'visita' }] });
    expect(normalizeTrigger({ event: 'lead_ads', form_id: 'f9' }))
      .toMatchObject({ event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: ['f9'] }] });
  });

  it('vazio vira "Escolha o gatilho"', () => {
    expect(normalizeTrigger(null)).toEqual({ event: '', conditions: [], alternatives: [] });
    expect(flowTriggerLabel('')).toBe('Escolha o gatilho');
  });
});

describe('edição', () => {
  const base: FlowTrigger = {
    event: 'lead.created',
    conditions: [
      { field: 'source', operator: 'eq', value: 'organico' },
      { field: 'pipeline_id', operator: 'eq', value: 'p1' },
    ],
  };

  it('o filtro do gatilho e o do funil não se apagam', () => {
    const a = withTriggerCondition(base, { field: 'source', operator: 'eq', value: 'formulario' });
    expect(a.conditions).toEqual([
      { field: 'source', operator: 'eq', value: 'formulario' },
      { field: 'pipeline_id', operator: 'eq', value: 'p1' },
    ]);
    const b = withPipelineFilter(base, null);
    expect(b.conditions).toEqual([{ field: 'source', operator: 'eq', value: 'organico' }]);
  });

  it('trocar o gatilho tira o filtro do antigo e mantém o funil', () => {
    expect(changeTriggerEvent(base, 'lead.tag_added').conditions).toEqual([{ field: 'pipeline_id', operator: 'eq', value: 'p1' }]);
    // "Etapa alterada" não aceita filtro de funil.
    expect(changeTriggerEvent(base, 'lead.stage_changed').conditions).toEqual([]);
  });

  it('etiqueta e etapa são obrigatórias nos gatilhos delas', () => {
    expect(triggerProblem({ event: '', conditions: [] })).toBeTruthy();
    expect(triggerProblem({ event: 'lead.tag_added', conditions: [] })).toBeTruthy();
    expect(triggerProblem({ event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'quente' }] })).toBeNull();
    expect(triggerProblem({ event: 'lead.stage_changed', conditions: [{ field: 'pipeline_id', operator: 'eq', value: 'p' }] })).toBeTruthy();
    expect(triggerProblem({ event: 'lead.created', conditions: [] })).toBeNull();
  });
});

// Sprint 3 (03/10/2026): "+ Ou quando…". O fluxo começa quando QUALQUER um
// acontece; cada alternativa tem o próprio filtro e o próprio funil.
describe('mais de um gatilho ("Ou quando")', () => {
  const principal: FlowTrigger = {
    event: 'lead.stage_changed',
    conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }],
  };

  it('vai pro servidor como alternatives: [{ event, conditions }]', () => {
    let t = addAlternative(principal);
    t = updateAlternative(t, 0, { event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] });
    t = addAlternative(t);
    t = updateAlternative(t, 1, { event: 'lead.visit_completed', conditions: [{ field: 'pipeline_id', operator: 'eq', value: '' }] });
    expect(serializeTrigger(t)).toEqual({
      event: 'lead.stage_changed',
      conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }],
      alternatives: [
        { event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] },
        // Condição vazia não vai, igual no principal.
        { event: 'lead.visit_completed', conditions: [] },
      ],
    });
  });

  it('lê as alternativas do servidor (e traduz nome antigo de evento)', () => {
    const t = normalizeTrigger({
      event: 'lead.stage_changed',
      conditions: [],
      alternatives: [{ event: 'tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] }, { event: 'lead.visit_completed' }],
    });
    expect(t.alternatives).toEqual([
      { event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] },
      { event: 'lead.visit_completed', conditions: [] },
    ]);
  });

  it('ida e volta sem perder nada', () => {
    const t: FlowTrigger = {
      ...principal,
      alternatives: [{ event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] }],
    };
    expect(normalizeTrigger(serializeTrigger(t))).toEqual(t);
  });

  it('tirar a alternativa e trocar o principal não mexem nas outras', () => {
    const t: FlowTrigger = {
      ...principal,
      alternatives: [{ event: 'lead.visit_completed', conditions: [] }, { event: 'lead.created', conditions: [] }],
    };
    expect(removeAlternative(t, 0).alternatives).toEqual([{ event: 'lead.created', conditions: [] }]);
    expect(changeTriggerEvent(t, 'lead.created').alternatives).toEqual(t.alternatives);
    expect(withTriggerCondition(t, null).alternatives).toEqual(t.alternatives);
  });

  it('o resumo junta os nomes com "ou"', () => {
    const t: FlowTrigger = { ...principal, alternatives: [{ event: 'lead.tag_added', conditions: [] }, { event: 'lead.visit_completed', conditions: [] }] };
    expect(flowTriggerSummary(t)).toBe('Etapa alterada ou Etiqueta adicionada ou Visita realizada');
    expect(triggerEvents(t)).toEqual(['lead.stage_changed', 'lead.tag_added', 'lead.visit_completed']);
  });

  it('cada alternativa é conferida como o principal', () => {
    const vazia = addAlternative(principal);
    expect(triggerProblem(vazia)).toBe('No "Ou quando": escolha o gatilho.');
    const semEtiqueta = updateAlternative(vazia, 0, { event: 'lead.tag_added', conditions: [] });
    expect(triggerProblem(semEtiqueta)).toBe('No "Ou quando": escolha qual etiqueta dispara o fluxo.');
    const pronta = updateAlternative(vazia, 0, { event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }] });
    expect(triggerProblem(pronta)).toBeNull();
  });
});

describe('linha do bloco Início (sprint 4)', () => {
  const describe_ = (_event: string, c: { field: string; value: string | string[] }) => `${c.field === 'label' ? 'Etiqueta' : c.field}: ${c.value}`;

  it('gatilho com filtro e "Ou quando" numa linha só', () => {
    const t: FlowTrigger = {
      event: 'lead.tag_added',
      conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }],
      alternatives: [{ event: 'lead.visit_completed', conditions: [] }],
    };
    expect(triggerOneLine(t, describe_)).toBe(
      `${flowTriggerLabel('lead.tag_added')} (Etiqueta: follow-up) · ou ${flowTriggerLabel('lead.visit_completed')}`,
    );
  });

  it('sem gatilho pede pra escolher; "Ou quando" ainda vazio não entra', () => {
    expect(triggerOneLine({ event: '', conditions: [] })).toBe('Escolha o gatilho');
    const t: FlowTrigger = { event: 'lead.created', conditions: [], alternatives: [{ event: '', conditions: [] }] };
    expect(triggerOneLine(t)).toBe(flowTriggerLabel('lead.created'));
  });

  it('filtro vazio não aparece entre parênteses', () => {
    const t: FlowTrigger = { event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: [] }] };
    expect(triggerOneLine(t, describe_)).toBe(flowTriggerLabel('lead.created'));
  });
});
