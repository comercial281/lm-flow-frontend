import { describe, it, expect } from 'vitest';
import {
  avisoSemente, faixaTexto, horaCurta, horariosDe30em30, opcoesDeHora, motivoDiaFechado, ordenarFolgas, rotuloFolga,
  type AgendaSettings, type TimeOff,
} from './agenda';

const HORARIO: AgendaSettings = {
  days: [1, 2, 3, 4, 5, 6],
  start: '08:00',
  end: '20:00',
  closed_dates: ['2026-10-12'],
};

const folga = (extra: Partial<TimeOff> = {}): TimeOff => ({
  id: 'f1',
  user_id: 'u-ana',
  user_name: 'Ana Teste',
  starts_on: '2026-10-07',
  ends_on: '2026-10-07',
  start_time: null,
  end_time: null,
  note: null,
  ...extra,
});

describe('faixaTexto e horaCurta', () => {
  it('hora cheia sem minutos, com minutos no formato 9h30', () => {
    expect(faixaTexto('08:00', '20:00')).toBe('8h às 20h');
    expect(faixaTexto('09:30', '18:00')).toBe('9h30 às 18h');
    expect(horaCurta('14:00:00')).toBe('14h');
    expect(horaCurta('07:30')).toBe('7h30');
  });
});

describe('horariosDe30em30', () => {
  it('vai de 00:00 a 23:30, em 24 h', () => {
    const lista = horariosDe30em30();
    expect(lista).toHaveLength(48);
    expect(lista[0]).toBe('00:00');
    expect(lista[17]).toBe('08:30');
    expect(lista[47]).toBe('23:30');
  });
});

describe('opcoesDeHora', () => {
  it('na grade: a lista de 30 em 30 como está', () => {
    expect(opcoesDeHora('08:00')).toEqual(horariosDe30em30());
  });

  it('fora da grade: entra na lista, no lugar certo', () => {
    const lista = opcoesDeHora('08:15');
    expect(lista).toHaveLength(49);
    expect(lista.slice(16, 19)).toEqual(['08:00', '08:15', '08:30']);
  });
});

describe('motivoDiaFechado', () => {
  it('dia da semana fora do horário fecha o dia, com o nome do dia', () => {
    // 04/10/2026 é domingo.
    expect(motivoDiaFechado(new Date(2026, 9, 4), HORARIO, [])).toBe('Domingo não tem visita');
  });

  it('data fechada (feriado) fecha o dia', () => {
    expect(motivoDiaFechado(new Date(2026, 9, 12), HORARIO, [])).toBe('Essa data está fechada para visitas');
    expect(motivoDiaFechado('2026-10-12', HORARIO, [])).toBe('Essa data está fechada para visitas');
  });

  it('folga de dia inteiro do corretor fecha o dia, inclusive no meio de um período', () => {
    expect(motivoDiaFechado(new Date(2026, 9, 7), HORARIO, [folga()])).toBe('Ana Teste está de folga nesse dia');
    const periodo = folga({ starts_on: '2026-10-06', ends_on: '2026-10-09' });
    expect(motivoDiaFechado(new Date(2026, 9, 8), HORARIO, [periodo])).toBe('Ana Teste está de folga nesse dia');
    expect(motivoDiaFechado(new Date(2026, 9, 10), HORARIO, [periodo])).toBeNull();
  });

  it('folga parcial (faixa de horas) NÃO fecha o dia', () => {
    const parcial = folga({ start_time: '14:00', end_time: '18:00' });
    expect(motivoDiaFechado(new Date(2026, 9, 7), HORARIO, [parcial])).toBeNull();
  });

  it('dia aberto, sem folga: null', () => {
    expect(motivoDiaFechado(new Date(2026, 9, 7), HORARIO, [])).toBeNull();
  });

  it('folga sem nome do corretor ainda fecha, com frase neutra', () => {
    expect(motivoDiaFechado(new Date(2026, 9, 7), HORARIO, [folga({ user_name: null })])).toBe('O corretor está de folga nesse dia');
  });
});

describe('rotuloFolga', () => {
  it('um dia só, com faixa', () => {
    expect(rotuloFolga(folga({ start_time: '14:00', end_time: '18:00' }))).toBe('Quarta, 07/10, das 14h às 18h');
  });

  it('um dia só, dia inteiro', () => {
    expect(rotuloFolga(folga())).toBe('Quarta, 07/10, dia inteiro');
  });

  it('período de vários dias (a faixa vale em cada dia do período)', () => {
    expect(rotuloFolga(folga({ ends_on: '2026-10-09' }))).toBe('07/10 a 09/10, dia inteiro');
    expect(rotuloFolga(folga({ ends_on: '2026-10-09', start_time: '08:00', end_time: '12:30' })))
      .toBe('07/10 a 09/10, das 8h às 12h30');
  });
});

describe('ordenarFolgas', () => {
  it('as próximas primeiro (início mais cedo), e no mesmo dia pela hora', () => {
    const lista = [
      folga({ id: 'c', starts_on: '2026-10-20', ends_on: '2026-10-20' }),
      folga({ id: 'b', starts_on: '2026-10-07', ends_on: '2026-10-07', start_time: '14:00', end_time: '18:00' }),
      folga({ id: 'a', starts_on: '2026-10-07', ends_on: '2026-10-07' }),
    ];
    expect(ordenarFolgas(lista).map(f => f.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('avisoSemente', () => {
  it('sem IAs diferentes: sem aviso', () => {
    expect(avisoSemente(undefined)).toBeNull();
    expect(avisoSemente({})).toBeNull();
    expect(avisoSemente({ agent_name: 'Sofia', differing_agent_names: [] })).toBeNull();
  });

  it('cita a IA usada e as que tinham horário diferente', () => {
    expect(avisoSemente({ agent_name: 'Sofia', differing_agent_names: ['Lia'] }))
      .toBe('As IAs Sofia e Lia tinham horários diferentes; usamos o de Sofia');
    expect(avisoSemente({ agent_name: 'Sofia', differing_agent_names: ['Lia', 'Bia'] }))
      .toBe('As IAs Sofia, Lia e Bia tinham horários diferentes; usamos o de Sofia');
  });
});
