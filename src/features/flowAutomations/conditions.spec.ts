import { describe, it, expect } from 'vitest';
import {
  CONDITION_CRITERIA,
  conditionProblem,
  conditionSentence,
  configForCriterion,
  criterionOf,
  labelOf,
  withLabel,
} from './conditions';

describe('critérios do Se / senão e do Só continuar se', () => {
  it('só os que funcionam, sem "veio de" nem o formulário antigo', () => {
    expect(CONDITION_CRITERIA.map(c => c.value)).toEqual(['replied', 'has_label', 'at_stage', 'has_email', 'has_phone', 'form_answer']);
  });

  it('o critério antigo continua aparecendo no bloco', () => {
    expect(criterionOf({ criterion: 'came_from', value: 'instagram' })).toBe('came_from');
    expect(conditionSentence({ criterion: 'came_from', value: 'instagram' })).toContain('critério antigo');
  });

  it('o Só continuar se antigo (lista de etiquetas) vira "Tem a etiqueta"', () => {
    expect(criterionOf({ labels: ['quente'], mode: 'all' })).toBe('has_label');
    expect(labelOf({ labels: ['quente'] })).toBe('quente');
  });

  it('no Só continuar se, a etiqueta grava também `labels` (o motor antigo lê isso)', () => {
    expect(withLabel('filter_label', configForCriterion('filter_label', 'has_label'), 'quente'))
      .toEqual({ criterion: 'has_label', label: 'quente', labels: ['quente'], mode: 'all' });
    expect(withLabel('condition', configForCriterion('condition', 'has_label'), 'quente'))
      .toEqual({ criterion: 'has_label', label: 'quente' });
  });

  it('frases e o que falta', () => {
    expect(conditionSentence({ criterion: 'replied', window_hours: 2 })).toBe('Se o lead respondeu nas últimas 2 horas');
    expect(conditionSentence({ criterion: 'at_stage', stage_id: 's1' }, { stageName: () => 'Visita' })).toBe('Se o lead está na etapa "Visita"');
    expect(conditionProblem({ criterion: 'has_label', label: '' })).toBe('Escolha a etiqueta.');
    expect(conditionProblem({ criterion: 'has_email' })).toBeNull();
    expect(conditionProblem({ criterion: 'form_answer' })).toBe('Escolha o formulário.');
  });
});
