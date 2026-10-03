import { describe, it, expect } from 'vitest';
import { reentryOf, reentryWarning, serializeReentry, reentrySummary, REENTRY_EVERY_MESSAGE_WARNING } from './reentry';

describe('"Pode rodar de novo pro mesmo lead"', () => {
  it('lê as três escolhas do servidor', () => {
    expect(reentryOf({ reentry_window_hours: 24 })).toEqual({ mode: 'hours', hours: 24 });
    expect(reentryOf({ reentry_window_hours: 0 })).toEqual({ mode: 'always', hours: 24 });
    expect(reentryOf({ reentry_window_hours: 48, once_per_lead: true })).toEqual({ mode: 'once', hours: 48 });
    // O servidor guarda em `state`: vale também.
    expect(reentryOf({ reentry_window_hours: 24, state: { once_per_lead: true } })).toEqual({ mode: 'once', hours: 24 });
  });

  it('sem nada (servidor antigo) é "depois de 24 horas"', () => {
    expect(reentryOf(null)).toEqual({ mode: 'hours', hours: 24 });
    expect(reentryOf({})).toEqual({ mode: 'hours', hours: 24 });
  });

  it('grava reentry_window_hours (0 = sempre) e once_per_lead', () => {
    expect(serializeReentry({ mode: 'hours', hours: 6 })).toEqual({ reentry_window_hours: 6, once_per_lead: false });
    expect(serializeReentry({ mode: 'always', hours: 6 })).toEqual({ reentry_window_hours: 0, once_per_lead: false });
    expect(serializeReentry({ mode: 'once', hours: 6 })).toEqual({ reentry_window_hours: 6, once_per_lead: true });
    // "Depois de 0 horas" seria "sempre" escondido: o mínimo é 1.
    expect(serializeReentry({ mode: 'hours', hours: 0 })).toEqual({ reentry_window_hours: 24, once_per_lead: false });
    expect(serializeReentry({ mode: 'hours', hours: 1 })).toEqual({ reentry_window_hours: 1, once_per_lead: false });
  });

  it('ida e volta', () => {
    for (const s of [{ mode: 'hours', hours: 12 }, { mode: 'always', hours: 24 }, { mode: 'once', hours: 24 }] as const) {
      expect(reentryOf(serializeReentry(s))).toEqual(s);
    }
  });

  it('"Sempre" com Mensagem recebida avisa que roda a cada mensagem', () => {
    expect(reentryWarning({ mode: 'always', hours: 24 }, 'lead.message_received')).toBe(REENTRY_EVERY_MESSAGE_WARNING);
    expect(REENTRY_EVERY_MESSAGE_WARNING).toMatch(/roda a cada mensagem do lead/);
    expect(reentryWarning({ mode: 'hours', hours: 24 }, 'lead.message_received')).toBeNull();
    expect(reentryWarning({ mode: 'always', hours: 24 }, 'lead.created')).toBeNull();
  });

  it('frase curta pro botão', () => {
    expect(reentrySummary({ mode: 'hours', hours: 1 })).toBe('Roda de novo depois de 1 hora');
    expect(reentrySummary({ mode: 'once', hours: 24 })).toBe('Roda uma vez por lead');
  });
});
