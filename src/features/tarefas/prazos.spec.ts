import { describe, expect, it } from 'vitest';
import { juntarDataEHora, prazoDaTarefa, proximaHoraCheia, separarDataEHora } from './prazos';

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

  describe('prazo no cartão da tarefa (14/10/2026)', () => {
    const agora = new Date(2026, 9, 14, 14, 0); // quarta
    const em = (d: number, h: number, m = 0) => new Date(2026, 9, 14 + d, h, m).toISOString();

    it('hora à parte e o dia por extenso perto de hoje', () => {
      expect(prazoDaTarefa(em(0, 16, 30), agora)).toEqual({ hora: '16:30', dia: 'Hoje', atraso: null });
      expect(prazoDaTarefa(em(1, 9), agora).dia).toBe('Amanhã');
      expect(prazoDaTarefa(em(-1, 18), agora).dia).toBe('Ontem');
    });

    it('mais longe, dia da semana e data; outro ano leva o ano', () => {
      expect(prazoDaTarefa(em(2, 10), agora).dia).toBe('Sex 16/10');
      expect(prazoDaTarefa(new Date(2027, 0, 5, 10).toISOString(), agora).dia).toBe('05/01/2027');
    });

    it('sem prazo não inventa hora', () => {
      expect(prazoDaTarefa(null, agora)).toEqual({ hora: null, dia: 'Sem prazo', atraso: null });
    });

    it('diz há quanto tempo venceu', () => {
      expect(prazoDaTarefa(em(0, 13, 35), agora).atraso).toBe('há 25 min');
      expect(prazoDaTarefa(em(0, 9), agora).atraso).toBe('há 5 h');
      expect(prazoDaTarefa(em(-1, 14), agora).atraso).toBe('há 1 dia');
      expect(prazoDaTarefa(em(-3, 9), agora).atraso).toBe('há 3 dias');
      expect(prazoDaTarefa(em(0, 16), agora).atraso).toBeNull();
    });
  });
});
