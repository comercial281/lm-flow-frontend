// src/pages/Customer/DashboardNova/blocos/Analise.spec.ts
import { describe, it, expect } from 'vitest';
import { melhorDia, percentualForaDoHorario, rotuloMes } from './Analise';

describe('análise do período', () => {
  it('o dia da semana que mais chega lead', () => {
    expect(melhorDia([{ day: 0, leads: 5 }, { day: 1, leads: 39 }, { day: 2, leads: 37 }])).toBe('Segunda-feira');
    expect(melhorDia([{ day: 0, leads: 0 }])).toBeNull();
  });

  it('dia da semana: sem dia, ou todos zerados, não tem melhor dia', () => {
    expect(melhorDia([])).toBeNull();
    expect(melhorDia(Array.from({ length: 7 }, (_, day) => ({ day, leads: 0 })))).toBeNull();
  });

  it('no empate, ganha o primeiro na ordem que o servidor manda', () => {
    expect(melhorDia([{ day: 0, leads: 3 }, { day: 3, leads: 8 }, { day: 5, leads: 8 }])).toBe('Quarta-feira');
    expect(melhorDia([{ day: 6, leads: 4 }, { day: 0, leads: 4 }])).toBe('Sábado');
    expect(melhorDia([{ day: 6, leads: 2 }])).toBe('Sábado');
  });

  it('quanto chegou fora do horário comercial (8h às 18h)', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, leads: hour === 10 ? 3 : hour === 22 ? 1 : 0 }));
    expect(percentualForaDoHorario(hours)).toBe(25);
    expect(percentualForaDoHorario(hours.map(h => ({ ...h, leads: 0 })))).toBeNull();
  });

  it('horário: as bordas (8h é dentro, 18h e 7h são fora) e a lista vazia', () => {
    expect(percentualForaDoHorario([{ hour: 8, leads: 1 }])).toBe(0);
    expect(percentualForaDoHorario([{ hour: 17, leads: 1 }])).toBe(0);
    expect(percentualForaDoHorario([{ hour: 18, leads: 1 }])).toBe(100);
    expect(percentualForaDoHorario([{ hour: 7, leads: 1 }])).toBe(100);
    expect(percentualForaDoHorario([{ hour: 0, leads: 1 }, { hour: 9, leads: 2 }])).toBe(33);
    expect(percentualForaDoHorario([])).toBeNull();
  });

  it('rótulo curto do mês', () => {
    expect(rotuloMes('2026-09')).toBe('Set');
    expect(rotuloMes('2026-04')).toBe('Abr');
    expect(rotuloMes('2026-01')).toBe('Jan');
    expect(rotuloMes('2026-12')).toBe('Dez');
  });

  it('rótulo do mês: valor fora do formato volta como veio', () => {
    expect(rotuloMes('2026-13')).toBe('2026-13');
    expect(rotuloMes('')).toBe('');
  });
});
