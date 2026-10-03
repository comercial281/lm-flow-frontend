import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { RETIRED_ACTION_TYPES, WAIT_ACTION_NOTICE } from '@/services/leadAutomation/leadAutomationService';
import { formatActionSummary, type AutomationResources } from './LeadAutomationsEditors';

// "Aguardar (delay)" sai da lista de ações (Automações · sprint 1): o servidor
// nunca esperou nessa etapa. Regra que já tem a ação continua igual, com aviso.
const semComentarios = (bruto: string) => bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pagina = semComentarios(readFileSync(resolve(__dirname, 'LeadAutomations.tsx'), 'utf8'));

describe('Aguardar (delay) nas Automações', () => {
  it('não aparece pra ação nova', () => {
    expect(RETIRED_ACTION_TYPES.has('wait')).toBe(true);
    expect(pagina).toContain('.filter(([value]) => !RETIRED_ACTION_TYPES.has(value))');
  });

  it('a ação que já existe continua na lista dela', () => {
    expect(pagina).toContain('actionTypesFor(action.type)');
  });

  it('o cartão da regra avisa que a etapa não espera', () => {
    expect(formatActionSummary({ type: 'wait', params: { minutes: 30 } }, {} as AutomationResources)).toBe(WAIT_ACTION_NOTICE);
    expect(WAIT_ACTION_NOTICE).toBe('Esta etapa não espera: as ações seguintes saem na hora');
  });
});
