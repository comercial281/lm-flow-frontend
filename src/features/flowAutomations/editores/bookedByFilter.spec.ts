import { describe, it, expect } from 'vitest';
import { bookedByCondition, bookedByOf, bookedBySummary, BOOKED_BY_TRIGGERS } from './bookedByFilter';
import { conditionsOnTriggerChange, triggerNeedsCondition, validateRule } from './LeadAutomationsEditors';
import { TRIGGER_LABELS, FLOW_ONLY_TRIGGERS } from '@/services/leadAutomation/leadAutomationService';
import { FLOW_TRIGGER_GROUPS } from '@/features/flowAutomations/trigger';

const envio = [{ type: 'send_whatsapp_message', params: { message: 'Oi {{nome}}' } }];

describe('filtro "Quem marcou"', () => {
  it('Qualquer um não grava condição', () => {
    expect(bookedByCondition('')).toBeNull();
  });

  it('A IA e Uma pessoa gravam booked_by eq', () => {
    expect(bookedByCondition('ia')).toEqual({ field: 'booked_by', operator: 'eq', value: 'ia' });
    expect(bookedByCondition('pessoa')).toEqual({ field: 'booked_by', operator: 'eq', value: 'pessoa' });
  });

  it('lê a condição gravada e ignora outras', () => {
    expect(bookedByOf({ field: 'booked_by', operator: 'eq', value: 'ia' })).toBe('ia');
    expect(bookedByOf({ field: 'source', operator: 'eq', value: 'ia' })).toBe('');
    expect(bookedByOf(null)).toBe('');
  });

  it('resumo em português', () => {
    expect(bookedBySummary({ field: 'booked_by', operator: 'eq', value: 'ia' })).toBe('Quem marcou: a IA');
    expect(bookedBySummary({ field: 'booked_by', operator: 'eq', value: 'pessoa' })).toBe('Quem marcou: uma pessoa');
    // Valor/campo desconhecido: mostra a condição crua em vez de mentir.
    expect(bookedBySummary({ field: 'booked_by', operator: 'eq', value: 'robo' })).toBe('booked_by eq "robo"');
  });

  it('vale nos dois gatilhos de visita e ambos aceitam o filtro', () => {
    expect(BOOKED_BY_TRIGGERS).toEqual(['lead.visit_scheduled', 'lead.visit_rescheduled']);
    BOOKED_BY_TRIGGERS.forEach(t => expect(triggerNeedsCondition(t)).toBe(true));
  });

  it('Visita remarcada: nome, só no construtor, no grupo Visita logo depois de agendada', () => {
    expect(TRIGGER_LABELS['lead.visit_rescheduled']).toBe('Visita remarcada');
    expect(FLOW_ONLY_TRIGGERS).toContain('lead.visit_rescheduled');
    const visita = FLOW_TRIGGER_GROUPS.find(g => g.label === 'Visita')!;
    expect(visita.events.slice(0, 2)).toEqual(['lead.visit_scheduled', 'lead.visit_rescheduled']);
  });

  // Qualquer um = sem condição: a regra não pode ser recusada por isso.
  it('a regra sem condição (Qualquer um) é válida nos dois gatilhos de visita', () => {
    expect(validateRule('lead.visit_scheduled', [], envio)).toEqual({ ok: true });
    expect(validateRule('lead.visit_rescheduled', [], envio)).toEqual({ ok: true });
  });

  it('o filtro só sobrevive dentro do mesmo gatilho de visita', () => {
    const c = bookedByCondition('ia')!;
    expect(conditionsOnTriggerChange('lead.visit_scheduled', 'lead.visit_scheduled', [c])).toEqual([c]);
    expect(conditionsOnTriggerChange('lead.visit_scheduled', 'lead.visit_rescheduled', [c])).toEqual([]);
    expect(conditionsOnTriggerChange('lead.visit_scheduled', 'lead.created', [c])).toEqual([]);
  });
});
