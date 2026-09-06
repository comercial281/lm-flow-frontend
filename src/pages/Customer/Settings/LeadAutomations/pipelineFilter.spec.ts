import { describe, it, expect } from 'vitest';
import {
  isPipelineCondition,
  triggerAcceptsPipelineFilter,
  validateRule,
  formatConditionSummary,
  type AutomationResources,
} from './LeadAutomationsEditors';
import type { LeadAutomationCondition } from '@/services/leadAutomation/leadAutomationService';

const funil = (id: string): LeadAutomationCondition =>
  ({ field: 'pipeline_id', operator: 'eq', value: id });
const origem: LeadAutomationCondition = { field: 'source', operator: 'eq', value: 'formulario' };
const etiqueta: LeadAutomationCondition = { field: 'label', operator: 'eq', value: 'quente' };

const resources = {
  labels: [], sequences: [], users: [],
  pipelines: [{ id: 'p1', name: 'Lançamento' }, { id: 'p2', name: 'Locação' }],
  stagesByPipeline: {}, quickReplies: [], adOrigins: [], formOrigins: [],
  messageFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

describe('filtro de funil', () => {
  it('separa a condição de funil da condição do gatilho', () => {
    expect(isPipelineCondition(funil('p1'))).toBe(true);
    expect(isPipelineCondition(origem)).toBe(false);
  });

  // "Card mudou de etapa" já escolhe a etapa, e a etapa diz de qual funil é.
  it('não oferece o filtro no gatilho de mudança de etapa', () => {
    expect(triggerAcceptsPipelineFilter('lead.created')).toBe(true);
    expect(triggerAcceptsPipelineFilter('lead.tag_added')).toBe(true);
    expect(triggerAcceptsPipelineFilter('lead.stage_changed')).toBe(false);
  });

  it('mostra o nome do funil na lista, nunca o identificador', () => {
    expect(formatConditionSummary('lead.created', funil('p2'), resources)).toBe('Funil: Locação');
  });

  // A armadilha: as duas condições viajam no mesmo array. Sem separar, escolher
  // um funil faria um gatilho que EXIGE condição passar sem ela.
  it('não deixa o funil valer como a condição obrigatória do gatilho', () => {
    const acoes = [{ type: 'add_label', params: { label_id: 'x' } }];

    expect(validateRule('lead.tag_added', [funil('p1')], acoes).ok).toBe(false);
    expect(validateRule('lead.tag_added', [etiqueta, funil('p1')], acoes).ok).toBe(true);
  });

  it('mantém opcional o filtro do gatilho que já era opcional', () => {
    const acoes = [{ type: 'add_label', params: { label_id: 'x' } }];

    expect(validateRule('lead.created', [funil('p1')], acoes).ok).toBe(true);
    expect(validateRule('lead.created', [], acoes).ok).toBe(true);
  });
});
