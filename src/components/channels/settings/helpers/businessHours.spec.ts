import { describe, it, expect, vi } from 'vitest';

vi.mock('@/i18n/config', () => ({ default: { t: (k: string) => k } }));

import {
  generateTimeSlots,
  getTime,
  timeSlotParse,
  timeSlotTransform,
  validateTimeSlot,
  calculateTotalHours,
  MEIA_NOITE,
} from './businessHours';

// Fase 3: horário do Canal em 24h. O servidor guarda número (hora/minuto);
// estes testes garantem que o que estava salvo volta IGUAL depois da troca.

describe('horário de funcionamento em 24h', () => {
  it('lista de horários de 30 em 30 minutos, 00:00 a 23:30, sem AM/PM', () => {
    const slots = generateTimeSlots(30);
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe('00:00');
    expect(slots[19]).toBe('09:30');
    expect(slots[34]).toBe('17:00');
    expect(slots[47]).toBe('23:30');
    expect(slots.join(' ')).not.toMatch(/AM|PM/);
  });

  it('getTime escreve 24h com zero à esquerda', () => {
    expect(getTime(9, 5)).toBe('09:05');
    expect(getTime(17, 0)).toBe('17:00');
    expect(getTime(0, 0)).toBe(MEIA_NOITE);
  });

  it('ida e volta com o servidor não muda nada do que estava salvo', () => {
    const doServidor = [
      { day_of_week: 1, closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 17, close_minutes: 30, open_all_day: false },
      { day_of_week: 0, closed_all_day: true, open_hour: 0, open_minutes: 0, close_hour: 0, close_minutes: 0, open_all_day: false },
    ];
    const naTela = timeSlotParse(doServidor);
    expect(naTela[0]).toMatchObject({ from: '09:00', to: '17:30', valid: true });
    expect(timeSlotTransform(naTela)).toEqual(doServidor);
  });

  it('valida e soma as horas, com meia-noite como fim do dia', () => {
    expect(validateTimeSlot('09:00', '17:00')).toBe(true);
    expect(validateTimeSlot('17:00', '09:00')).toBe(false);
    expect(validateTimeSlot('18:00', MEIA_NOITE)).toBe(true);
    expect(calculateTotalHours({ day: 1, from: '09:00', to: '17:30', valid: true })).toBe(8.5);
    expect(calculateTotalHours({ day: 1, from: '18:00', to: MEIA_NOITE, valid: true })).toBe(6);
  });
});
