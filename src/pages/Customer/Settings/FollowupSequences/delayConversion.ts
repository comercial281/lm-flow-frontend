/**
 * Unidades de tempo da tela (minutos, horas, dias). Hoje só os blocos Esperar e
 * Aguardar resposta do construtor usam (`features/flowAutomations/waitTime.ts`):
 * o editor de funil antigo, que também as usava, saiu na Fase 4.
 */

export const UNITS = [
  { value: 'min', label: 'minutos', factor: 1 },
  { value: 'h',   label: 'horas',   factor: 60 },
  { value: 'd',   label: 'dias',    factor: 1440 },
] as const;

export type DelayUnit = (typeof UNITS)[number]['value'];

export const unitFactor = (u: DelayUnit): number =>
  UNITS.find(x => x.value === u)?.factor ?? 1;

/** Maior unidade que divide sem sobra: 10080 vira "7 dias", não "10080 minutos". */
export const pickUnit = (minutes: number): DelayUnit => {
  if (minutes > 0 && minutes % 1440 === 0) return 'd';
  if (minutes > 0 && minutes % 60 === 0) return 'h';
  return 'min';
};
