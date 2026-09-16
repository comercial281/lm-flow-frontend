import { describe, it, expect } from 'vitest';
import { deadlineLabel, hasDeadline, isNoDeadline, timeoutLabel } from './offerDeadline';
import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

// A roleta sem prazo: `deadline` nulo NÃO é "prazo esgotado". Antes desta
// tradução, `new Date(null)` virava NaN e todo selo pintava "esgotado".

function oferta(over: Partial<BrokerAssignmentDetail>): BrokerAssignmentDetail {
  return {
    id: 'o1', status: 'pending', lead_name: 'Lead', lead_phone: null,
    assigned_at: '2026-09-16T12:00:00Z', deadline: '2026-09-16T12:30:00Z',
    minutes_remaining: 30, timeout_minutes: 30, round: 1, corretor: null,
    conversation_id: null, conversation_display_id: null, ...over,
  };
}

const AGORA = new Date('2026-09-16T12:20:00Z').getTime();
const SEM = { deadline: null, minutes_remaining: null, timeout_minutes: 0, no_deadline: true };

describe('isNoDeadline', () => {
  it('zero é sem prazo; positivo e ausente não são', () => {
    expect(isNoDeadline(0)).toBe(true);
    expect(isNoDeadline(30)).toBe(false);
    expect(isNoDeadline(null)).toBe(false);
    expect(isNoDeadline(undefined)).toBe(false);
  });
});

describe('hasDeadline', () => {
  it('oferta com prazo tem cronômetro', () => {
    expect(hasDeadline(oferta({}))).toBe(true);
  });

  it('oferta sem prazo não tem, seja pelo sinal explícito, pelo deadline nulo ou pelo zero', () => {
    expect(hasDeadline(oferta(SEM))).toBe(false);
    expect(hasDeadline(oferta({ deadline: null }))).toBe(false);
    expect(hasDeadline(oferta({ timeout_minutes: 0 }))).toBe(false);
  });
});

describe('deadlineLabel', () => {
  it('conta os minutos contra o prazo', () => {
    expect(deadlineLabel(oferta({}), AGORA)).toBe('10 min');
  });

  it('vencido vira "prazo esgotado"', () => {
    expect(deadlineLabel(oferta({}), new Date('2026-09-16T13:00:00Z').getTime())).toBe('prazo esgotado');
  });

  it('sem prazo NUNCA vira "prazo esgotado"', () => {
    expect(deadlineLabel(oferta(SEM), new Date('2030-01-01T00:00:00Z').getTime())).toBe('sem prazo');
  });
});

describe('timeoutLabel', () => {
  it('traduz o prazo gravado para o resumo', () => {
    expect(timeoutLabel(30)).toBe('30 min');
    expect(timeoutLabel(0)).toBe('sem prazo');
    expect(timeoutLabel(null)).toBeNull();
  });
});
