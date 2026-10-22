import { describe, it, expect } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { canBecomeCondition, toCondition } from './filterToCondition';

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'filter_label', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

describe('Só continuar se vira Condição', () => {
  it('converte filtro com critério mantendo o caminho', () => {
    const out = toCondition(node({ kind: 'filter_label', config: { criterion: 'has_label', label: 'quente', labels: ['quente'], mode: 'all' }, next_node_id: 'b2' }));
    expect(out).toMatchObject({ kind: 'condition', config: { criterion: 'has_label', label: 'quente' }, next_yes_node_id: 'b2', next_node_id: null, next_no_node_id: null });
    expect(out.config).not.toHaveProperty('labels');
    expect(out.config).not.toHaveProperty('mode');
  });

  it('filtro com critério sem próximo bloco fica com o Sim vazio', () => {
    const out = toCondition(node({ config: { criterion: 'has_email' }, next_node_id: null }));
    expect(out.kind).toBe('condition');
    expect(out.next_yes_node_id).toBeNull();
    expect(out.next_node_id).toBeNull();
  });

  it('filtro legado sem critério não converte', () => {
    expect(canBecomeCondition(node({ kind: 'filter_label', config: { labels: ['x'], mode: 'any' } }))).toBe(false);
  });

  it('só filtro com critério converte', () => {
    expect(canBecomeCondition(node({ config: { criterion: 'has_label', label: 'a' } }))).toBe(true);
    expect(canBecomeCondition(node({ kind: 'condition', config: { criterion: 'has_label' } }))).toBe(false);
  });
});
