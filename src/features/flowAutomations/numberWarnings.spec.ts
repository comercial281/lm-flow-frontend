import { describe, it, expect } from 'vitest';
import { numberWarnings } from './numberWarnings';
import type { FlowTrigger } from './trigger';
import type { FlowAutomationNode } from '@/types/flowAutomations';

const trig = (event: string, alts: string[] = []) =>
  ({ event, conditions: [], alternatives: alts.map(e => ({ event: e, conditions: [] })) }) as unknown as FlowTrigger;
const node = (id: string, kind: string, next: string | null = null, extra: Partial<FlowAutomationNode> = {}) =>
  ({ id, kind, config: {}, next_node_id: next, next_yes_node_id: null, next_no_node_id: null, ...extra }) as unknown as FlowAutomationNode;
const set = (mode: '' | 'owner' | 'number', inboxId = '') => ({ mode, inboxId, onConflict: 'pause' as const });
const CONFLICT = 'Esse lead normalmente já conversa com o corretor em outro número. Escolha “Seguir pela conversa dele” ou o número da conversa.';
const NO_AI = 'Esse número não tem IA. Escolha o número da IA ou tire o bloco Passar para a IA.';
const NO_OPEN = 'A IA só responde, não abre conversa. Ponha uma Mensagem antes do Passar para a IA.';
const base = { nodes: [] as FlowAutomationNode[], initialNodeId: null, inboxesWithAi: new Set<string>() };

describe('numberWarnings', () => {
  it('conflito: visita realizada com número do responsável', () => {
    expect(numberWarnings({ ...base, trigger: trig('lead.visit_completed'), setting: set('owner') })).toEqual([CONFLICT]);
  });
  it('conflito vale também no Ou quando', () => {
    expect(numberWarnings({ ...base, trigger: trig('lead.created', ['lead.stage_changed']), setting: set('number', 'i1') })).toEqual([CONFLICT]);
  });
  it('aceite da roleta não avisa', () => {
    expect(numberWarnings({ ...base, trigger: trig('lead.roleta_accepted'), setting: set('owner') })).toEqual([]);
  });
  it('modo conversa não avisa conflito', () => {
    expect(numberWarnings({ ...base, trigger: trig('lead.visit_completed'), setting: set('') })).toEqual([]);
  });
  it('sem regra de número não avisa nada', () => {
    expect(numberWarnings({ ...base, trigger: trig('lead.visit_completed'), setting: null })).toEqual([]);
  });
  it('número sem IA com Passar para a IA', () => {
    const nodes = [node('m', 'send_whatsapp', 'h'), node('h', 'hand_to_ai')];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'm', setting: set('number', 'i1') })).toEqual([NO_AI]);
  });
  it('número com IA não avisa', () => {
    const nodes = [node('m', 'send_whatsapp', 'h'), node('h', 'hand_to_ai')];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'm', setting: set('number', 'i1'), inboxesWithAi: new Set(['i1']) })).toEqual([]);
  });
  it('Passar para a IA sem Mensagem antes', () => {
    const nodes = [node('w', 'wait', 'h'), node('h', 'hand_to_ai')];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'w', setting: set('') })).toEqual([NO_OPEN]);
  });
  it('Mensagem em outro ramo não conta', () => {
    const nodes = [
      node('c', 'condition', null, { next_yes_node_id: 'm', next_no_node_id: 'h' }),
      node('m', 'send_whatsapp'), node('h', 'hand_to_ai'),
    ];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'c', setting: set('') })).toEqual([NO_OPEN]);
  });
  it('Mensagem num dos caminhos até a IA basta', () => {
    const nodes = [
      node('c', 'condition', null, { next_yes_node_id: 'm', next_no_node_id: 'w' }),
      node('m', 'send_whatsapp', 'h'), node('w', 'wait', 'h'), node('h', 'hand_to_ai'),
    ];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'c', setting: set('') })).toEqual([]);
  });
  it('ciclo não trava', () => {
    const nodes = [node('a', 'wait', 'b'), node('b', 'wait', 'a'), node('h', 'hand_to_ai')];
    expect(() => numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'a', setting: set('') })).not.toThrow();
  });
  it('Disparar funil antes do Passar para a IA conta como mensagem', () => {
    for (const action_type of ['send_message_funnel', 'send_quick_reply', 'send_whatsapp_message', 'send_audio']) {
      const nodes = [node('f', 'lead_action', 'h', { config: { action_type, params: {} } } as Partial<FlowAutomationNode>), node('h', 'hand_to_ai')];
      expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'f', setting: set('') })).toEqual([]);
    }
  });
  it('lead_action que não manda mensagem não conta', () => {
    const nodes = [node('f', 'lead_action', 'h', { config: { action_type: 'add_label', params: {} } } as Partial<FlowAutomationNode>), node('h', 'hand_to_ai')];
    expect(numberWarnings({ ...base, trigger: trig('lead.created'), nodes, initialNodeId: 'f', setting: set('') })).toEqual([NO_OPEN]);
  });
});
