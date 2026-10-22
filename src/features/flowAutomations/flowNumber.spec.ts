import { describe, it, expect } from 'vitest';
import { flowNumberOf, serializeFlowNumber, withFlowSendFrom } from './flowNumber';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';

const flow = (over: Partial<FlowAutomation>): FlowAutomation => ({ id: 'f1', name: 'Fluxo', ...over }) as FlowAutomation;
const msg = (send_from: string, send_from_inbox_id: string): FlowAutomationNode =>
  ({ id: `m${send_from}${send_from_inbox_id}`, kind: 'send_whatsapp', config: { text: 'Oi', send_from, send_from_inbox_id } }) as unknown as FlowAutomationNode;
const leadAction = (action: string): FlowAutomationNode =>
  ({ id: 'a1', kind: 'lead_action', config: { action, params: { text: 'x' } } }) as unknown as FlowAutomationNode;

describe('flowNumberOf', () => {
  it('fluxo com send_from salvo', () => {
    const r = flowNumberOf(flow({ send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause' }), []);
    expect(r.saved).toBe(true);
    expect(r.setting).toEqual({ mode: 'number', inboxId: 'i1', onConflict: 'pause' });
  });
  it('infere das Mensagens iguais com follow_conversation', () => {
    expect(flowNumberOf(flow({}), [msg('number', 'i1'), msg('number', 'i1')]).setting).toEqual({
      mode: 'number', inboxId: 'i1', onConflict: 'follow_conversation',
    });
  });
  it('Mensagens diferentes ficam divergentes', () => {
    const r = flowNumberOf(flow({}), [msg('number', 'i1'), msg('owner', '')]);
    expect(r.divergent).toBe(true);
    expect(r.setting.mode).toBe('');
    expect(r.saved).toBe(false);
  });
});

describe('serializeFlowNumber', () => {
  it('devolve os três campos do PATCH', () => {
    expect(serializeFlowNumber({ mode: 'number', inboxId: 'i1', onConflict: 'pause' })).toEqual({
      send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause',
    });
  });
});

describe('withFlowSendFrom', () => {
  it('espelha só em send_whatsapp', () => {
    const out = withFlowSendFrom([msg('', ''), leadAction('send_whatsapp_message')], { mode: 'number', inboxId: 'i9', onConflict: 'pause' });
    expect(out[0].config).toMatchObject({ send_from: 'number', send_from_inbox_id: 'i9' });
    expect(out[1].config).toEqual(leadAction('send_whatsapp_message').config);
  });
});
