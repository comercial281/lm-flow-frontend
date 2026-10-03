import { describe, it, expect } from 'vitest';
import {
  acceptedByIds,
  acceptedByCondition,
  acceptedByOptions,
  acceptedBySummary,
  toggleAcceptedBy,
} from './acceptedByFilter';
import {
  conditionsOnTriggerChange,
  triggerNeedsCondition,
  validateRule,
  formatConditionSummary,
  type AutomationResources,
} from './LeadAutomationsEditors';
import type { LeadAutomationCondition } from '@/services/leadAutomation/leadAutomationService';
import type { User } from '@/types/users';

const user = (id: string, name: string, extra: Partial<User> = {}) =>
  ({ id, name, ...extra }) as User;

const users = [user('1', 'Ana'), user('2', 'Bia'), user('3', 'Carlos', { deactivated: true })];

const resources = {
  labels: [], sequences: [], followupFlows: [], users, pipelines: [], stagesByPipeline: {},
  quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const envio = [{ type: 'send_whatsapp_message', params: { message: 'Oi {{nome}}' } }];

describe('filtro por quem aceitou', () => {
  it('grava a lista no campo que o servidor manda no gatilho do aceite', () => {
    expect(acceptedByCondition(['1', '2'])).toEqual({ field: 'assigned_user_id', operator: 'in', value: ['1', '2'] });
  });

  // `in []` não casaria com ninguém: a regra pararia calada. Vazio = qualquer corretor.
  it('nenhum marcado não grava condição nenhuma', () => {
    expect(acceptedByCondition([])).toBeNull();
  });

  it('lê valor único legado e id numérico como string', () => {
    expect(acceptedByIds({ field: 'assigned_user_id', operator: 'eq', value: '7' })).toEqual(['7']);
    expect(acceptedByIds({ field: 'assigned_user_id', operator: 'in', value: [7 as unknown as string] })).toEqual(['7']);
    expect(acceptedByIds({ field: 'label', operator: 'eq', value: 'quente' })).toEqual([]);
  });

  it('marca e desmarca', () => {
    expect(toggleAcceptedBy(['1'], '2')).toEqual(['1', '2']);
    expect(toggleAcceptedBy(['1', '2'], '1')).toEqual(['2']);
  });

  // Esconder um marcado faria a regra seguir filtrando por alguém que a tela não mostra.
  it('esconde desativado, a não ser que já esteja marcado', () => {
    expect(acceptedByOptions(users, []).map(o => o.id)).toEqual(['1', '2']);
    expect(acceptedByOptions(users, ['3']).find(o => o.id === '3')).toMatchObject({ deactivated: true });
  });

  it('mantém à mostra quem está marcado e saiu da conta', () => {
    const fora = acceptedByOptions(users, ['99']).find(o => o.id === '99');
    expect(fora).toMatchObject({ missing: true });
  });

  it('resume pelo nome, nunca pelo id', () => {
    expect(acceptedBySummary(['1', '2'], users)).toBe('Só quando quem aceitou for: Ana, Bia');
    expect(acceptedBySummary([], users)).toBe('Qualquer corretor que aceitar');
    expect(formatConditionSummary('lead.roleta_accepted', acceptedByCondition(['2'])!, resources))
      .toBe('Só quando quem aceitou for: Bia');
  });

  it('o gatilho do aceite oferece o filtro, e ele é opcional', () => {
    expect(triggerNeedsCondition('lead.roleta_accepted')).toBe(true);
    expect(validateRule('lead.roleta_accepted', [], envio).ok).toBe(true);
    expect(validateRule('lead.roleta_accepted', [acceptedByCondition(['1'])!], envio).ok).toBe(true);
  });
});

describe('troca de gatilho', () => {
  const etiqueta: LeadAutomationCondition = { field: 'label', operator: 'eq', value: 'quente' };
  const funil: LeadAutomationCondition = { field: 'pipeline_id', operator: 'eq', value: 'p1' };

  // A etiqueta levada para o aceite ficaria gravada e invisível, barrando a regra.
  it('descarta a condição do gatilho antigo', () => {
    expect(conditionsOnTriggerChange('lead.tag_added', 'lead.roleta_accepted', [etiqueta])).toEqual([]);
  });

  it('o filtro de funil atravessa onde o gatilho novo o oferece', () => {
    expect(conditionsOnTriggerChange('lead.tag_added', 'lead.roleta_accepted', [etiqueta, funil])).toEqual([funil]);
    expect(conditionsOnTriggerChange('lead.tag_added', 'lead.stage_changed', [etiqueta, funil])).toEqual([]);
  });

  it('mesmo gatilho preserva tudo', () => {
    const quem = acceptedByCondition(['1'])!;
    expect(conditionsOnTriggerChange('lead.roleta_accepted', 'lead.roleta_accepted', [quem, funil]))
      .toEqual([quem, funil]);
  });
});
