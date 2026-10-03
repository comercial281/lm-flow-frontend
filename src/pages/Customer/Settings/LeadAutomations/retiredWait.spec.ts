import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPE_LABELS,
  LEGACY_ACTION_TYPES,
  RETIRED_ACTION_TYPES,
  WAIT_ACTION_NOTICE,
} from '@/services/leadAutomation/leadAutomationService';
import { formatActionSummary, type AutomationResources } from './LeadAutomationsEditors';

// "Aguardar (delay)" sai da lista de ações (Automações · sprint 1): o servidor
// nunca esperou nessa etapa. Regra que já tem a ação continua igual, com aviso.
const semComentarios = (bruto: string) => bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pagina = semComentarios(readFileSync(resolve(__dirname, 'LeadAutomations.tsx'), 'utf8'));

describe('Aguardar (delay) nas Automações', () => {
  it('não aparece pra ação nova', () => {
    expect(RETIRED_ACTION_TYPES.has('wait')).toBe(true);
    expect(pagina).toContain('RETIRED_ACTION_TYPES.has(value) || LEGACY_ACTION_TYPES.has(value)');
    expect(pagina).toContain('.filter(([value]) => !naoOferecida(value))');
  });

  it('a ação que já existe continua na lista dela', () => {
    expect(pagina).toContain('actionTypesFor(action.type)');
  });

  it('o cartão da regra avisa que a etapa não espera', () => {
    expect(formatActionSummary({ type: 'wait', params: { minutes: 30 } }, {} as AutomationResources)).toBe(WAIT_ACTION_NOTICE);
    expect(WAIT_ACTION_NOTICE).toBe('Esta etapa não espera: as ações seguintes saem na hora');
  });
});

// Sprint 3 (03/10/2026): o follow-up virou fluxo. A ação nova é "Iniciar
// follow-up" (escolhe um fluxo de follow-up); a do funil antigo continua valendo
// na regra que já tem, mas não é oferecida.
describe('Iniciar follow-up nas Automações', () => {
  it('a ação nova escolhe um fluxo de follow-up', () => {
    expect(ACTION_TYPE_LABELS.start_followup_flow).toBe('Iniciar follow-up');
    expect(LEGACY_ACTION_TYPES.has('start_followup_sequence')).toBe(true);
    expect(LEGACY_ACTION_TYPES.has('start_followup_flow')).toBe(false);
  });

  it('o cartão da regra mostra o nome do follow-up', () => {
    const resources = { followupFlows: [{ id: 'f1', name: 'Follow-up longo' }] } as unknown as AutomationResources;
    expect(formatActionSummary({ type: 'start_followup_flow', params: { flow_automation_id: 'f1' } }, resources)).toBe('Follow-up: Follow-up longo');
    expect(formatActionSummary({ type: 'start_followup_flow', params: {} }, resources)).toBe('Follow-up: (não definido)');
  });
});
