// "PODE RODAR DE NOVO PRO MESMO LEAD" (sprint 2, spec 03/10/2026, seção 3).
//
// Três escolhas, dois campos no servidor:
//   Depois de [X] horas            → reentry_window_hours: X,  once_per_lead: false
//   Sempre que o gatilho acontecer → reentry_window_hours: 0,  once_per_lead: false
//   Só uma vez por lead            → once_per_lead: true (as horas ficam guardadas)
//
// O servidor guarda `once_per_lead` dentro de `state`; a leitura aceita o campo
// solto ou dentro de `state`, e a gravação manda solto.

import type { FlowAutomation } from '@/types/flowAutomations';

export type ReentryMode = 'hours' | 'always' | 'once';

export interface ReentrySetting {
  mode: ReentryMode;
  /** As horas do "Depois de [X] horas" (guardadas mesmo nos outros modos). */
  hours: number;
}

export const DEFAULT_REENTRY_HOURS = 24;

export const REENTRY_OPTIONS: Array<{ value: ReentryMode; label: string }> = [
  { value: 'hours', label: 'Depois de um tempo' },
  { value: 'always', label: 'Sempre que o gatilho acontecer' },
  { value: 'once', label: 'Só uma vez por lead' },
];

export const REENTRY_EVERY_MESSAGE_WARNING = 'Com "Mensagem recebida", roda a cada mensagem do lead.';

type ReentrySource = Partial<Pick<FlowAutomation, 'reentry_window_hours' | 'once_per_lead' | 'state'>>;

export function reentryOf(source: ReentrySource | null | undefined): ReentrySetting {
  const raw = Number(source?.reentry_window_hours);
  const hours = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_REENTRY_HOURS;
  const once = source?.once_per_lead ?? source?.state?.once_per_lead;
  if (once === true) return { mode: 'once', hours: hours > 0 ? hours : DEFAULT_REENTRY_HOURS };
  if (hours === 0) return { mode: 'always', hours: DEFAULT_REENTRY_HOURS };
  return { mode: 'hours', hours };
}

export function serializeReentry(setting: ReentrySetting): { reentry_window_hours: number; once_per_lead: boolean } {
  const hours = Math.max(1, Math.floor(Number(setting.hours) || DEFAULT_REENTRY_HOURS));
  switch (setting.mode) {
    case 'always':
      return { reentry_window_hours: 0, once_per_lead: false };
    case 'once':
      return { reentry_window_hours: hours, once_per_lead: true };
    default:
      return { reentry_window_hours: hours, once_per_lead: false };
  }
}

/** O aviso da escolha "Sempre" com o gatilho Mensagem recebida, ou null. */
export function reentryWarning(setting: ReentrySetting, event: string | null | undefined): string | null {
  return setting.mode === 'always' && event === 'lead.message_received' ? REENTRY_EVERY_MESSAGE_WARNING : null;
}

/** Frase curta da escolha, pro botão do topo do canvas. */
export function reentrySummary(setting: ReentrySetting): string {
  if (setting.mode === 'always') return 'Roda sempre que o gatilho acontecer';
  if (setting.mode === 'once') return 'Roda uma vez por lead';
  return `Roda de novo depois de ${setting.hours === 1 ? '1 hora' : `${setting.hours} horas`}`;
}
