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

// ── Segundos (sprint 4, funil de conversa) ──────────────────────────────────
//
// O funil de conversa espera segundos ("espera 5s" entre uma mensagem e outra):
// `wait.config.seconds`, somado com `minutes` no servidor. A tela guarda o
// total quebrado em minutos + segundos.

export type SecondsUnit = 's' | 'min' | 'h';

export const SECONDS_UNITS: Array<{ value: SecondsUnit; label: string; factor: number }> = [
  { value: 's', label: 'segundos', factor: 1 },
  { value: 'min', label: 'minutos', factor: 60 },
  { value: 'h', label: 'horas', factor: 3600 },
];

/** Tem segundos no tempo do Esperar (o bloco passa a falar em segundos). */
export function waitHasSeconds(config: { seconds?: unknown } | null | undefined): boolean {
  return Number(config?.seconds) > 0;
}

/** O tempo do Esperar em segundos (minutos + segundos). */
export function waitTotalSeconds(config: { minutes?: unknown; seconds?: unknown } | null | undefined): number {
  const minutes = Math.max(0, Math.round(Number(config?.minutes) || 0));
  const seconds = Math.max(0, Math.round(Number(config?.seconds) || 0));
  return minutes * 60 + seconds;
}

/** 5 → { 5, 's' }; 120 → { 2, 'min' }; 7200 → { 2, 'h' }. Zero ou lixo vira 1 segundo. */
export function splitSeconds(total: unknown): { amount: number; unit: SecondsUnit } {
  const t = Math.max(1, Math.round(Number(total) || 0));
  if (t % 3600 === 0) return { amount: t / 3600, unit: 'h' };
  if (t % 60 === 0) return { amount: t / 60, unit: 'min' };
  return { amount: t, unit: 's' };
}

/** O que vai no config: `{ minutes, seconds }` (nunca menos de 1 segundo). */
export function joinSeconds(amount: unknown, unit: SecondsUnit): { minutes: number; seconds: number } {
  const factor = SECONDS_UNITS.find(u => u.value === unit)?.factor ?? 1;
  const total = Math.max(1, Math.round(Number(amount) || 0)) * factor;
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

/** "5 segundos", "2 minutos", "1 minuto e 30 segundos". */
export function describeSeconds(total: unknown): string {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (t < 60) return plural(t, 'segundo', 'segundos');
  if (t % 60 === 0) return describeMinutes(t / 60);
  const minutes = Math.floor(t / 60);
  return `${plural(minutes, 'minuto', 'minutos')} e ${plural(t % 60, 'segundo', 'segundos')}`;
}

/** A linha do bloco Esperar no canvas, nos três modos (tempo, horário comercial, data). */
export function describeWait(config: { mode?: unknown; minutes?: unknown; seconds?: unknown; target_at?: unknown; business_hours?: unknown } | null | undefined): string {
  const mode = String(config?.mode ?? 'interval');
  if (mode === 'date') {
    return config?.target_at ? `Espera até ${dataHora(config.target_at)}` : 'Espera até uma data (escolha a data)';
  }
  const tempo = waitHasSeconds(config) ? describeSeconds(waitTotalSeconds(config)) : describeMinutes(config?.minutes ?? 1440);
  return waitUsesBusinessHours(config) ? `Espera ${tempo}, em horário comercial` : `Espera ${tempo}`;
}
