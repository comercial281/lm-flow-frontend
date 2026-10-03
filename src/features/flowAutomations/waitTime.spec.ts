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
