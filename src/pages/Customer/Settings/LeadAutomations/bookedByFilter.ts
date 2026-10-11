import type { LeadAutomationCondition } from '@/services/leadAutomation/leadAutomationService';

// "Quem marcou" a visita (spec 2026-10-11-visita-quem-marcou-design.md).
//
// O servidor manda `booked_by` ('ia' | 'pessoa') no contexto de "Visita
// agendada" e "Visita remarcada", e o filtro do gatilho compara qualquer campo
// do contexto. Qualquer um = sem condição (o comportamento de antes).

export const BOOKED_BY_FIELD = 'booked_by';
export type BookedBy = 'ia' | 'pessoa';
export const BOOKED_BY_TRIGGERS = ['lead.visit_scheduled', 'lead.visit_rescheduled'];

export const BOOKED_BY_OPTIONS: { value: '' | BookedBy; label: string }[] = [
  { value: '', label: 'Qualquer um' },
  { value: 'ia', label: 'A IA' },
  { value: 'pessoa', label: 'Uma pessoa' },
];

export function bookedByOf(condition: LeadAutomationCondition | null | undefined): '' | BookedBy {
  if (condition?.field !== BOOKED_BY_FIELD) return '';
  return condition.value === 'ia' || condition.value === 'pessoa' ? condition.value : '';
}

export function bookedByCondition(value: '' | BookedBy): LeadAutomationCondition | null {
  return value ? { field: BOOKED_BY_FIELD, operator: 'eq', value } : null;
}

export function bookedBySummary(condition: LeadAutomationCondition): string {
  const by = bookedByOf(condition);
  if (by === 'ia') return 'Quem marcou: a IA';
  if (by === 'pessoa') return 'Quem marcou: uma pessoa';
  // Campo ou valor desconhecido: mostra a condição crua em vez de afirmar algo falso.
  return `${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`;
}
