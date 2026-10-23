import { describe, it, expect } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { buildEdges } from '@/lib/flowAutomationGraph';
import { canBecomeCondition, toCondition, willConvert } from './filterToCondition';

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

  it('critério vazio conta como sem critério', () => {
    expect(canBecomeCondition(node({ config: { criterion: '', labels: ['x'] } }))).toBe(false);
  });

  it('id, nome, posição e passo do guia sobrevivem', () => {
    const out = toCondition(node({ id: 'z9', label: 'Quente?', pos_x: 10, pos_y: 20, guide_done: true, config: { criterion: 'has_email' } }));
    expect(out).toMatchObject({ id: 'z9', label: 'Quente?', pos_x: 10, pos_y: 20, guide_done: true });
  });

  it('modo guiado nunca converte', () => {
    const n = node({ config: { criterion: 'has_email' }, next_node_id: 'b2' });
    expect(willConvert(n, true)).toBe(false);
    expect(willConvert(n, false)).toBe(true);
  });

  it('o mapa desenha a seta saindo do Sim depois da conversão', () => {
    const out = toCondition(node({ config: { criterion: 'has_email' }, next_node_id: 'b2' }));
    const edges = buildEdges([out], null);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 'n1', target: 'b2', sourceHandle: 'yes' });
  });
});
