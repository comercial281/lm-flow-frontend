import { describe, it, expect } from 'vitest';
import { offerFor, minutesLeft } from './pendingOffersMatch';
import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

function oferta(over: Partial<BrokerAssignmentDetail>): BrokerAssignmentDetail {
  return {
    id: 'oferta-1',
    status: 'pending',
    lead_name: 'Lead',
    lead_phone: null,
    assigned_at: '2026-09-03T12:00:00Z',
    deadline: '2026-09-03T12:30:00Z',
    minutes_remaining: 30,
    timeout_minutes: 30,
    round: 1,
    corretor: 'João',
    conversation_id: null,
    conversation_display_id: null,
    contact_id: 'contato-1',
    ...over,
  };
}

describe('offerFor', () => {
  // Lead de formulário/anúncio não tem conversa: o card só tem o contato.
  it('acha a oferta pelo contato', () => {
    expect(offerFor([oferta({})], { contactId: 'contato-1' })?.id).toBe('oferta-1');
  });

  it('acha a oferta pela conversa quando o card só conhece a conversa', () => {
    const o = oferta({ conversation_id: 'conv-uuid', conversation_display_id: 42 });
    expect(offerFor([o], { conversationId: 'conv-uuid' })?.id).toBe('oferta-1');
    expect(offerFor([o], { conversationDisplayId: '42' })?.id).toBe('oferta-1');
  });

  it('não confunde o lead de outro card', () => {
    expect(offerFor([oferta({})], { contactId: 'contato-2' })).toBeUndefined();
  });

  it('oferta já encerrada não conta', () => {
    expect(offerFor([oferta({ status: 'accepted' })], { contactId: 'contato-1' })).toBeUndefined();
  });

  it('não casa vazio com vazio', () => {
    expect(offerFor([oferta({ contact_id: null })], { contactId: null })).toBeUndefined();
  });
});

describe('minutesLeft', () => {
  it('mede contra o prazo do servidor, não contra o número que envelheceu', () => {
    const o = oferta({ minutes_remaining: 30 });
    expect(minutesLeft(o, new Date('2026-09-03T12:20:00Z').getTime())).toBe(10);
  });

  it('nunca fica negativo', () => {
    expect(minutesLeft(oferta({}), new Date('2026-09-03T13:00:00Z').getTime())).toBe(0);
  });
});
