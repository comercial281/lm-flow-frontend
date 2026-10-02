import { describe, it, expect } from 'vitest';
import { buildExampleFlow, EXAMPLE_FLOW_NAME } from './exampleFlow';
import { buildSaveFlowPayload } from '@/lib/flowAutomationGraph';
import type { FlowAutomationNode } from '@/types/flowAutomations';

describe('exemplo "Primeiro contato com nova tentativa"', () => {
  it('Lead criado → WhatsApp pelo responsável → Aguardar 30 min → Não respondeu: outra mensagem', () => {
    const { trigger, flow } = buildExampleFlow();
    expect(EXAMPLE_FLOW_NAME).toBe('Primeiro contato com nova tentativa');
    expect(trigger).toEqual({ event: 'lead.created', conditions: [] });
    const byId = new Map(flow.nodes.map(n => [n.id, n]));
    const first = byId.get(flow.initial_node_id!)!;
    expect(first.kind).toBe('send_whatsapp');
    expect(first.config.send_from).toBe('owner');
    const wait = byId.get(first.next_node_id!)!;
    expect(wait.kind).toBe('wait_for_reply');
    expect(wait.config).toEqual({ minutes: 30, indefinite: false });
    expect(wait.next_yes_node_id).toBeNull();
    const retry = byId.get(wait.next_no_node_id!)!;
    expect(retry.kind).toBe('send_whatsapp');
    expect(String(retry.config.text)).not.toBe(String(first.config.text));
  });

  it('sai igual pelo save_flow', () => {
    const { flow } = buildExampleFlow();
    expect(buildSaveFlowPayload(flow.nodes as FlowAutomationNode[], flow.initial_node_id)).toEqual(flow);
  });
});
