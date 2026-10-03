import { describe, it, expect } from 'vitest';
import {
  leadActionConfig, leadActionLabel, leadActionOf, leadActionProblem, isLeadActionType, newLeadActionConfig,
} from './leadAction';
import { summaryLine } from '@/components/flowAutomations/FlowNodeCard';
import { formatActionSummary, type AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import { missingActionParams } from '@/services/leadAutomation/leadAutomationService';

const resources: AutomationResources = {
  labels: [], sequences: [], users: [{ id: 'u1', name: 'Ana' } as never], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

const block = (config: Record<string, unknown>) => ({
  id: 'b1', kind: 'lead_action' as const, label: null, config,
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
});

describe('bloco "ação das Automações" (lead_action)', () => {
  it('config { action_type, params } ↔ ação no formato da regra, ida e volta', () => {
    const config = { action_type: 'notify_group', params: { group_jid: '123@g.us', message: 'Novo lead {{nome}}' } };
    const action = leadActionOf(config);
    expect(action).toEqual({ type: 'notify_group', params: { group_jid: '123@g.us', message: 'Novo lead {{nome}}' } });
    expect(leadActionConfig(action)).toEqual(config);
  });

  it('config vazia ou estranha não quebra', () => {
    expect(leadActionOf(undefined)).toEqual({ type: '', params: {} });
    expect(leadActionOf({ action_type: 7, params: ['x'] })).toEqual({ type: '', params: {} });
    expect(newLeadActionConfig('create_task')).toEqual({ action_type: 'create_task', params: {} });
  });

  it('aceita toda ação das Automações, menos a aposentada "Aguardar (delay)"', () => {
    expect(isLeadActionType('notify_push')).toBe(true);
    expect(isLeadActionType('wait')).toBe(false);
    expect(isLeadActionType('nao_existe')).toBe(false);
  });

  it('nome do bloco: o da spec, e o da regra quando não tem um próprio', () => {
    expect(leadActionLabel('assign_via_roleta')).toBe('Distribuir pela roleta');
    expect(leadActionLabel('notify_user')).toBe('Avisar pessoa');
  });

  it('o que falta usa o MESMO mapa de obrigatórios da regra, em português', () => {
    expect(missingActionParams({ type: 'notify_group', params: {} })).toEqual(['group_jid', 'message']);
    expect(leadActionProblem({ action_type: 'notify_group', params: {} })).toBe('Falta preencher o destino do aviso e a mensagem.');
    expect(leadActionProblem({ action_type: 'assign_broker', params: {} })).toBe('Falta preencher o corretor.');
    expect(leadActionProblem({ action_type: 'notify_push', params: { user_ids: [], message: 'Oi' } })).toBe('Falta preencher quem recebe a notificação.');
    expect(leadActionProblem({ action_type: 'assign_via_roleta', params: {} })).toBeNull();
    expect(leadActionProblem({ action_type: 'create_task', params: { title: 'Ligar' } })).toBeNull();
  });

  it('o cartão no canvas mostra a frase da lista de regras', () => {
    const actionSummary = (a: Parameters<typeof formatActionSummary>[0]) => formatActionSummary(a, resources);
    expect(summaryLine(block({ action_type: 'assign_broker', params: { user_id: 'u1' } }), { actionSummary })).toBe('Corretor: Ana');
    expect(summaryLine(block({ action_type: 'assign_via_roleta', params: {} }), { actionSummary })).toBe('Distribui via roleta');
    expect(summaryLine(block({ action_type: 'create_task', params: {} }), { actionSummary })).toBe('(tarefa sem título)');
  });
});
