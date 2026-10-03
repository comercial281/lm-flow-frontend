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
    });
  });

  it('nada solto (stage_id, label…) e condição vazia não vai', () => {
    const out = serializeTrigger({ event: 'lead.tag_added', conditions: [{ field: 'label', operator: 'eq', value: '' }] });
    expect(out).toEqual({ event: 'lead.tag_added', conditions: [] });
    expect(Object.keys(out)).toEqual(['event', 'conditions']);
  });
});

describe('leitura', () => {
  it('o formato novo passa como veio', () => {
    expect(normalizeTrigger({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }] }))
      .toEqual({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }] });
  });

  it('o formato antigo é traduzido', () => {
    expect(normalizeTrigger({ event: 'contact_created' })).toEqual({ event: 'lead.created', conditions: [] });
    expect(normalizeTrigger({ event: 'stage_changed', stage_id: 's1', pipeline_id: 'p1' }))
      .toEqual({ event: 'lead.stage_changed', conditions: [{ field: 'to_stage_id', operator: 'eq', value: 's1' }] });
    expect(normalizeTrigger({ event: 'tag_added', label: 'quente' }).conditions)
      .toEqual([{ field: 'label', operator: 'eq', value: 'quente' }]);
    expect(normalizeTrigger({ event: 'keyword', keyword: 'visita' }))
      .toEqual({ event: 'lead.message_received', conditions: [{ field: 'content', operator: 'contains', value: 'visita' }] });
    expect(normalizeTrigger({ event: 'lead_ads', form_id: 'f9' }))
      .toEqual({ event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: ['f9'] }] });
  });

  it('vazio vira "Escolha o gatilho"', () => {
    expect(normalizeTrigger(null)).toEqual({ event: '', conditions: [] });
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
