import { describe, expect, it } from 'vitest';
import { juntarDataEHora, proximaHoraCheia, separarDataEHora } from './prazos';

describe('prazos da tarefa', () => {
  it('junta data e hora no horário local e volta igual', () => {
    const iso = juntarDataEHora('2026-10-09', '14:30');
    expect(separarDataEHora(iso)).toEqual({ data: '2026-10-09', hora: '14:30' });
  });

  it('aceita data no passado', () => {
    const iso = juntarDataEHora('2020-01-02', '08:05');
    expect(new Date(iso).getFullYear()).toBe(2020);
  });

  it('a próxima hora cheia vira o dia quando passa da meia-noite', () => {
    expect(proximaHoraCheia(new Date(2026, 9, 7, 15, 20))).toEqual({ data: '2026-10-07', hora: '16:00' });
    expect(proximaHoraCheia(new Date(2026, 9, 7, 23, 40))).toEqual({ data: '2026-10-08', hora: '00:00' });
  });
});
