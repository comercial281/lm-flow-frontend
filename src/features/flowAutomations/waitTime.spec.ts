import { describe, it, expect } from 'vitest';
import { describeWait, describeWaitForReply, joinMinutes, splitMinutes } from './waitTime';

describe('tempo em minutos, horas ou dias (guardado em minutos)', () => {
  it('ida e volta', () => {
    expect(splitMinutes(30)).toEqual({ amount: 30, unit: 'min' });
    expect(splitMinutes(120)).toEqual({ amount: 2, unit: 'h' });
    expect(splitMinutes(2880)).toEqual({ amount: 2, unit: 'd' });
    expect(joinMinutes(3, 'h')).toBe(180);
    expect(joinMinutes(1, 'd')).toBe(1440);
    expect(joinMinutes(0, 'min')).toBe(1);
  });

  it('as linhas dos blocos', () => {
    expect(describeWaitForReply({ minutes: 30 })).toBe('Espera a resposta por até 30 minutos');
    expect(describeWaitForReply({ minutes: 1440, indefinite: true })).toBe('Espera a resposta, sem limite');
    expect(describeWait({ mode: 'interval', minutes: 60 })).toBe('Espera 1 hora');
    // O modo antigo `schedule` e a caixa nova (`business_hours`) dizem o mesmo (sprint 3).
    expect(describeWait({ mode: 'schedule', minutes: 2880 })).toBe('Espera 2 dias, em horário comercial');
    expect(describeWait({ mode: 'interval', minutes: 2880, business_hours: true })).toBe('Espera 2 dias, em horário comercial');
    expect(describeWaitForReply({ minutes: 1440, business_hours: true })).toBe('Espera a resposta por até 1 dia, em horário comercial');
  });
});

// Sprint 4: o Esperar do funil de conversa fala em segundos (minutos + segundos somam).
describe('Esperar em segundos (funil de conversa)', () => {
  it('ida e volta e a linha do bloco', async () => {
    const { joinSeconds, splitSeconds, waitTotalSeconds, describeSeconds } = await import('./waitTime');
    expect(joinSeconds(5, 's')).toEqual({ minutes: 0, seconds: 5 });
    expect(joinSeconds(2, 'min')).toEqual({ minutes: 2, seconds: 0 });
    expect(joinSeconds(90, 's')).toEqual({ minutes: 1, seconds: 30 });
    expect(splitSeconds(waitTotalSeconds({ minutes: 0, seconds: 10 }))).toEqual({ amount: 10, unit: 's' });
    expect(splitSeconds(120)).toEqual({ amount: 2, unit: 'min' });
    expect(describeSeconds(90)).toBe('1 minuto e 30 segundos');
    expect(describeWait({ mode: 'interval', minutes: 0, seconds: 5 })).toBe('Espera 5 segundos');
    // Sem segundos, continua em minutos como antes.
    expect(describeWait({ mode: 'interval', minutes: 30 })).toBe('Espera 30 minutos');
  });
});

describe('Esperar dos fluxos de lead: segundos a dias (08/10/2026)', () => {
  it('quebra o tempo em segundos, minutos, horas ou dias', async () => {
    const { splitSeconds, joinSeconds, LEAD_WAIT_UNITS } = await import('./waitTime');
    expect(LEAD_WAIT_UNITS.map(u => u.value)).toEqual(['s', 'min', 'h', 'd']);
    expect(splitSeconds(10, true)).toEqual({ amount: 10, unit: 's' });
    expect(splitSeconds(86400, true)).toEqual({ amount: 1, unit: 'd' });
    expect(splitSeconds(86400)).toEqual({ amount: 24, unit: 'h' });
    expect(joinSeconds(10, 's')).toEqual({ minutes: 0, seconds: 10 });
    expect(joinSeconds(2, 'd')).toEqual({ minutes: 2880, seconds: 0 });
  });

  it('sem nada gravado, o padrão continua 1 dia; minutos antigos são lidos', async () => {
    const { leadWaitSeconds } = await import('./waitTime');
    expect(leadWaitSeconds({})).toBe(86400);
    expect(leadWaitSeconds({ minutes: 30 })).toBe(1800);
    expect(leadWaitSeconds({ minutes: 0, seconds: 15 })).toBe(15);
    expect(describeWait({ mode: 'interval', minutes: 0, seconds: 15, business_hours: true }))
      .toBe('Espera 15 segundos, em horário comercial');
  });
});
