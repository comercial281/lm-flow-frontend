import { describe, it, expect } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import {
  appendTarget,
  branchHandles,
  buildEdges,
  buildSaveFlowPayload,
  calculateLayout,
  handleLabel,
  link,
  looseOutputs,
  normalizeLoadedNodes,
} from './flowAutomationGraph';

const node = (id: string, kind: FlowAutomationNode['kind'], patch: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id, kind, label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: null, pos_y: null, steps: [],
  ...patch,
});

describe('Aguardar resposta tem duas saídas: Respondeu e Não respondeu', () => {
  it('com prazo, sim e não; sem limite, só Respondeu', () => {
    expect(branchHandles(node('a', 'wait_for_reply', { config: { minutes: 30 } }))).toEqual(['yes', 'no']);
    expect(branchHandles(node('a', 'wait_for_reply', { config: { indefinite: true } }))).toEqual(['yes']);
    expect(branchHandles(node('a', 'condition'))).toEqual(['yes', 'no']);
    expect(branchHandles(node('a', 'wait'))).toEqual([]);
  });

  it('os nomes das saídas', () => {
    expect(handleLabel('wait_for_reply', 'yes')).toBe('Respondeu');
    expect(handleLabel('wait_for_reply', 'no')).toBe('Não respondeu');
    expect(handleLabel('condition', 'yes')).toBe('Sim');
    expect(handleLabel('condition', 'no')).toBe('Não');
  });

  it('desenha as duas linhas a partir de next_yes / next_no', () => {
    const nodes = [
      node('w', 'wait_for_reply', { config: { minutes: 30 }, next_yes_node_id: 'a', next_no_node_id: 'b' }),
      node('a', 'add_label'),
      node('b', 'send_whatsapp'),
    ];
    const edges = buildEdges(nodes, 'w');
    expect(edges.map(e => [e.id, e.sourceHandle, e.target, e.label])).toEqual([
      ['trigger:out', 'out', 'w', ''],
      ['w:yes', 'yes', 'a', 'Respondeu'],
      ['w:no', 'no', 'b', 'Não respondeu'],
    ]);
    // "Não respondeu" é cinza, não o vermelho do "Não" do Se/senão.
    expect(edges[2].color).not.toBe(buildEdges([node('c', 'condition', { next_no_node_id: 'b' }), node('b', 'wait')], 'c')[1].color);
  });

  it('com "Sem limite" a linha de Não respondeu some, mesmo com o ponteiro gravado', () => {
    const nodes = [
      node('w', 'wait_for_reply', { config: { indefinite: true }, next_yes_node_id: 'a', next_no_node_id: 'b' }),
      node('a', 'add_label'),
      node('b', 'send_whatsapp'),
    ];
    expect(buildEdges(nodes, 'w').map(e => e.id)).toEqual(['trigger:out', 'w:yes']);
    expect(looseOutputs(nodes[0])).toEqual([]);
  });

  it('as saídas soltas viram o "+" do cartão', () => {
    expect(looseOutputs(node('w', 'wait_for_reply', { config: { minutes: 5 } }))).toEqual(['yes', 'no']);
    expect(looseOutputs(node('w', 'wait_for_reply', { config: { minutes: 5 }, next_yes_node_id: 'x' }))).toEqual(['no']);
    expect(looseOutputs(node('s', 'send_whatsapp'))).toEqual(['out']);
  });

  it('ligar pela saída Não respondeu grava next_no_node_id', () => {
    const out = link([node('w', 'wait_for_reply'), node('b', 'send_whatsapp')], 'w', 'no', 'b');
    expect(out[0].next_no_node_id).toBe('b');
    expect(out[0].next_node_id).toBeNull();
  });

  it('o layout põe as duas saídas em linhas diferentes', () => {
    const nodes = [
      node('w', 'wait_for_reply', { config: { minutes: 30 }, next_yes_node_id: 'a', next_no_node_id: 'b' }),
      node('a', 'add_label'),
      node('b', 'send_whatsapp'),
    ];
    const pos = calculateLayout(nodes, 'w');
    expect(pos.a.x).toBe(pos.b.x);
    expect(pos.a.y).not.toBe(pos.b.y);
  });
});

describe('onde a paleta pendura o bloco novo', () => {
  it('no fim da linha principal', () => {
    const nodes = [node('s', 'send_whatsapp', { next_node_id: 'w' }), node('w', 'wait')];
    expect(appendTarget(nodes, 's')).toEqual({ id: 'w', handle: 'out' });
  });

  it('depois de Aguardar resposta, na primeira saída livre (nunca na saída única que ele não tem)', () => {
    const nodes = [
      node('s', 'send_whatsapp', { next_node_id: 'w' }),
      node('w', 'wait_for_reply', { config: { minutes: 30 }, next_yes_node_id: 'x' }),
      node('x', 'add_label'),
    ];
    expect(appendTarget(nodes, 's')).toEqual({ id: 'w', handle: 'no' });
  });

  it('sem saída livre, o bloco entra solto', () => {
    const nodes = [
      node('c', 'condition', { next_yes_node_id: 'x', next_no_node_id: 'y' }),
      node('x', 'wait'),
      node('y', 'wait'),
    ];
    expect(appendTarget(nodes, 'c')).toBeNull();
  });
});

describe('o que vai no save_flow', () => {
  it('Aguardar resposta leva next_yes / next_no e nunca next_node_id', () => {
    const payload = buildSaveFlowPayload(
      [node('w', 'wait_for_reply', { config: { minutes: 30 }, next_node_id: 'z', next_yes_node_id: 'a', next_no_node_id: 'b' })],
      'w',
    );
    expect(payload.initial_node_id).toBe('w');
    expect(payload.nodes[0]).toMatchObject({ next_node_id: null, next_yes_node_id: 'a', next_no_node_id: 'b' });
  });

  it('com "Sem limite", Não respondeu vai nulo (contrato)', () => {
    const payload = buildSaveFlowPayload(
      [node('w', 'wait_for_reply', { config: { indefinite: true }, next_yes_node_id: 'a', next_no_node_id: 'b' })],
      'w',
    );
    expect(payload.nodes[0]).toMatchObject({ next_yes_node_id: 'a', next_no_node_id: null });
  });

  it('bloco de saída única não leva sim/não', () => {
    const payload = buildSaveFlowPayload([node('s', 'send_whatsapp', { next_node_id: 'x', next_yes_node_id: 'y' })], 's');
    expect(payload.nodes[0]).toMatchObject({ next_node_id: 'x', next_yes_node_id: null, next_no_node_id: null });
  });

  it('mantém os ids temporários (o servidor resolve)', () => {
    const payload = buildSaveFlowPayload([node('tmp_abc', 'wait')], 'tmp_abc');
    expect(payload.nodes[0].id).toBe('tmp_abc');
  });
});

describe('fluxo salvo antes da sprint 1', () => {
  it('a saída única do Aguardar resposta vira Respondeu', () => {
    const [w] = normalizeLoadedNodes([node('w', 'wait_for_reply', { next_node_id: 'a' })]);
    expect(w.next_node_id).toBeNull();
    expect(w.next_yes_node_id).toBe('a');
  });

  it('não mexe nos outros blocos', () => {
    const original = node('s', 'send_whatsapp', { next_node_id: 'a' });
    expect(normalizeLoadedNodes([original])[0]).toBe(original);
  });
});
