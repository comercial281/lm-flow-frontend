import type { FollowupStep } from '@/services/followupSequences/followupSequencesService';

/**
 * Tempo do passo: a TELA fala relativo, a API fala cumulativo.
 *
 * O backend guarda `delay_minutes` cumulativo desde o início do funil — é o que a
 * retomada e o horário comercial usam. A tela pergunta "esperar quanto DEPOIS DA
 * MENSAGEM ANTERIOR", que é como quem monta o funil pensa, e foi como o dono do
 * produto pediu em 2026-08-13.
 *
 * Fica em arquivo próprio (e não junto da tela) porque é a conversão que, errada,
 * estraga em silêncio o funil de um cliente: merece teste direto.
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

/** Cumulativo (API) → relativo (tela). O passo 1 já é relativo à entrada no funil. */
export const toRelativeSteps = (steps: FollowupStep[]): FollowupStep[] => {
  let previous = 0;
  return steps.map(s => {
    const cumulative = Number(s.delay_minutes) || 0;
    // Passo fora de ordem daria distância negativa, que viraria tempo negativo no
    // banco. Vira zero — "manda junto com a anterior".
    const relative = Math.max(0, cumulative - previous);
    previous = cumulative;
    return { ...s, delay_minutes: relative };
  });
};

/** Relativo (tela) → cumulativo (API). Soma corrida, na ordem dos passos. */
export const toCumulativeSteps = (steps: FollowupStep[]): FollowupStep[] => {
  let running = 0;
  return steps.map(s => {
    running += Math.max(0, Number(s.delay_minutes) || 0);
    return { ...s, delay_minutes: running };
  });
};

/**
 * Quanto tempo desde a entrada no funil até este passo. Quem monta um funil de 10
 * passos precisa disso pra não perder a noção do todo enquanto pensa em "mais 3
 * dias".
 */
export const cumulativeUpTo = (steps: FollowupStep[], idx: number): number =>
  steps.slice(0, idx + 1).reduce((acc, s) => acc + (Number(s.delay_minutes) || 0), 0);
