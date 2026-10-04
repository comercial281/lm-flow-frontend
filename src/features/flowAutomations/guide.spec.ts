import { describe, it, expect } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import {
  currentStep, fieldFilled, guideFinishedText, guideInstruction, guidePendingText, guideRequiredProblem, guideSteps,
  isGuided, isMessageNode, isReadOnly, messageCount, removeAndRewire, serverMessage, stepLabel,
} from './guide';
import { funnelPreview } from './funnelPreview';

// Automações · sprint 4 (04/10/2026), parte B: construção guiada e modo guiado.

const node = (id: string, patch: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id, kind: 'send_whatsapp', label: null, config: { text: 'Oi' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [], ...patch,
});
const guide = (step: number, done = false, title = `Passo ${step}`) => ({
  step, total: 3, title, hint: 'dica', required: ['text'], done,
});

describe('passos do guia', () => {
  const nodes = [
    node('c', { guide: guide(3) }),
    node('a', { guide: guide(1, true) }),
    node('w', { kind: 'wait', config: { seconds: 5 } }),
    node('b', { guide: guide(2, false, 'Escreva a mensagem de abertura') }),
  ];

  it('em ordem, e o atual é o primeiro que falta', () => {
    const steps = guideSteps(nodes);
    expect(steps.map(s => s.nodeId)).toEqual(['a', 'b', 'c']);
    expect(currentStep(steps)?.nodeId).toBe('b');
    expect(currentStep(guideSteps([node('x')]))).toBeNull();
  });

  it('a faixa e o "falta terminar" falam do passo atual', () => {
    const step = currentStep(guideSteps(nodes))!;
    expect(stepLabel(step)).toBe('Passo 2 de 3');
    expect(guideInstruction(step)).toBe('clique no bloco destacado e escreva a mensagem de abertura.');
    expect(guidePendingText(guideSteps(nodes))).toBe(
      'Falta terminar o guia antes de ligar: Passo 2 de 3 — Escreva a mensagem de abertura.',
    );
    expect(guidePendingText(guideSteps([node('a', { guide: guide(1, true) })]))).toBeNull();
  });

  it('o fim do guia', () => {
    expect(guideFinishedText('conversation')).toBe('Pronto! Seu funil já pode ser disparado nas conversas.');
    expect(guideFinishedText('automation')).toMatch(/^Pronto!/);
  });

  it('campo obrigatório: mesma régua do servidor (com ponto, texto em branco não vale)', () => {
    expect(fieldFilled({ params: { group_jid: '123@g.us' } }, 'params.group_jid')).toBe(true);
    expect(fieldFilled({ params: {} }, 'params.group_jid')).toBe(false);
    expect(fieldFilled({ text: '   ' }, 'text')).toBe(false);
    expect(guideRequiredProblem({ required: ['media_url'] }, { media_url: '' })).toBe('Escolha o arquivo pra mandar.');
    expect(guideRequiredProblem({ required: ['media_url'] }, { media_url: 'https://x/y.jpg' })).toBeNull();
    expect(guideRequiredProblem(null, {})).toBeNull();
  });
});

describe('modo guiado', () => {
  it('só mensagem conta como mensagem', () => {
    expect(isMessageNode(node('a'))).toBe(true);
    expect(isMessageNode(node('w', { kind: 'wait', config: {} }))).toBe(false);
    expect(isMessageNode(node('l', { kind: 'lead_action', config: { action_type: 'send_image' } }))).toBe(true);
    expect(isMessageNode(node('l', { kind: 'lead_action', config: { action_type: 'notify_group' } }))).toBe(false);
  });

  it('tirar mensagem religa o anterior ao seguinte (e o primeiro passa a ser o seguinte)', () => {
    const nodes = [
      node('m1', { next_node_id: 'w1' }),
      node('w1', { kind: 'wait', config: {}, next_node_id: 'm2' }),
      node('m2', { next_node_id: 'w2' }),
      node('w2', { kind: 'wait', config: {}, next_node_id: 'm3' }),
      node('m3'),
    ];
    const meio = removeAndRewire(nodes, 'm1', 'm2');
    expect(meio.nodes.map(n => n.id)).toEqual(['m1', 'w1', 'w2', 'm3']);
    expect(meio.nodes.find(n => n.id === 'w1')?.next_node_id).toBe('w2');
    expect(meio.initialNodeId).toBe('m1');
    const primeiro = removeAndRewire(nodes, 'm1', 'm1');
    expect(primeiro.initialNodeId).toBe('w1');
    expect(messageCount(primeiro.nodes)).toBe(2);
  });

  it('as permissões do servidor decidem modo guiado e só ver', () => {
    const perms = (p: Partial<{ can_edit: boolean; guided: boolean }>) => ({
      permissions: { can_edit: true, guided: false, can_mark_team: false, can_create_blank: false, ...p },
    });
    expect(isGuided(perms({ guided: true }))).toBe(true);
    expect(isGuided(perms({ guided: true, can_edit: false }))).toBe(false);
    expect(isReadOnly(perms({ can_edit: false }))).toBe(true);
    expect(isReadOnly({})).toBe(false);
  });

  it('a mensagem do servidor aparece como veio', () => {
    expect(serverMessage({ response: { data: { errors: ['No modo guiado não dá pra adicionar bloco.'] } } }, 'x'))
      .toBe('No modo guiado não dá pra adicionar bloco.');
    expect(serverMessage(new Error('boom'), 'Não deu.')).toBe('Não deu.');
  });
});

describe('prévia do funil (Disparar funil)', () => {
  it('mensagens e esperas na ordem dos blocos, a partir do primeiro', () => {
    const steps = funnelPreview({
      initial_node_id: 'm1',
      nodes: [
        node('m2', { config: { text: '', media_kind: 'image', media_url: 'https://x/f.jpg' }, next_node_id: null }),
        node('w1', { kind: 'wait', config: { mode: 'interval', minutes: 0, seconds: 5 }, next_node_id: 'm2' }),
        node('m1', { config: { text: 'Oi {{nome}}' }, next_node_id: 'w1' }),
      ],
    });
    expect(steps).toEqual([
      { kind: 'send_whatsapp', text: 'Oi {{nome}}' },
      { kind: 'wait', seconds: 5 },
      { kind: 'send_whatsapp', media_kind: 'image' },
    ]);
  });
});
