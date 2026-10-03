// Tempo dos blocos Esperar e Aguardar resposta: a tela fala "30 minutos",
// "2 horas", "1 dia"; o servidor guarda minutos. Mesmas unidades do funil de
// Follow-up (delayConversion), pra quem monta os dois pensar igual.

import { UNITS, pickUnit, unitFactor, type DelayUnit } from '@/pages/Customer/Settings/FollowupSequences/delayConversion';
import { dataHora, plural } from '@/lib/formato';
import { waitUsesBusinessHours } from './businessHours';

export { UNITS as WAIT_UNITS };
export type WaitUnit = DelayUnit;

export interface WaitAmount {
  amount: number;
  unit: WaitUnit;
}

/** 1440 → { 1, 'd' }; 90 → { 90, 'min' }. Zero ou lixo vira 1 minuto. */
export function splitMinutes(minutes: unknown): WaitAmount {
  const total = Math.max(1, Math.round(Number(minutes) || 0));
  const unit = pickUnit(total);
  return { amount: total / unitFactor(unit), unit };
}

/** Nunca devolve menos de 1 minuto (o servidor não espera "zero"). */
export function joinMinutes(amount: unknown, unit: WaitUnit): number {
  const n = Math.max(1, Math.round(Number(amount) || 0));
  return n * unitFactor(unit);
}

export function describeMinutes(minutes: unknown): string {
  const { amount, unit } = splitMinutes(minutes);
  if (unit === 'd') return plural(amount, 'dia', 'dias');
  if (unit === 'h') return plural(amount, 'hora', 'horas');
  return plural(amount, 'minuto', 'minutos');
}

// ── Aguardar resposta ───────────────────────────────────────────────────────

/** Texto de ajuda do bloco (spec 02/10, seção 1). */
export const WAIT_FOR_REPLY_HELP = 'Respondeu: o lead mandou qualquer mensagem depois da última que este fluxo enviou.';

/** A linha do bloco no canvas. */
export function describeWaitForReply(config: { minutes?: unknown; indefinite?: unknown; business_hours?: unknown } | null | undefined): string {
  if (config?.indefinite === true) return 'Espera a resposta, sem limite';
  const base = `Espera a resposta por até ${describeMinutes(config?.minutes ?? 1440)}`;
  return waitUsesBusinessHours(config) ? `${base}, em horário comercial` : base;
}

// ── Esperar ─────────────────────────────────────────────────────────────────

/** A linha do bloco Esperar no canvas, nos três modos (tempo, horário comercial, data). */
export function describeWait(config: { mode?: unknown; minutes?: unknown; target_at?: unknown; business_hours?: unknown } | null | undefined): string {
  const mode = String(config?.mode ?? 'interval');
  if (mode === 'date') {
    return config?.target_at ? `Espera até ${dataHora(config.target_at)}` : 'Espera até uma data (escolha a data)';
  }
  const tempo = describeMinutes(config?.minutes ?? 1440);
  return waitUsesBusinessHours(config) ? `Espera ${tempo}, em horário comercial` : `Espera ${tempo}`;
}
