import { describe, it, expect } from 'vitest';
import {
  atalhosDeDia, diaISO, horariosDoDia, ocupando, porExtenso, rotuloDuracao, type BusyVisit,
} from './daySlots';

// Quarta-feira, 30/09/2026, 14h10 (hora local).
const AGORA = new Date(2026, 8, 30, 14, 10);
const QUINTA = new Date(2026, 9, 1);

const visita = (h: number, m: number, dur: number | null, extra: Partial<BusyVisit> = {}): BusyVisit => ({
  id: `${h}${m}`,
  scheduled_at: new Date(2026, 9, 1, h, m).toISOString(),
  duration_minutes: dur,
  status: 'scheduled',
  contact: { name: 'Leonardo Teste' },
  ...extra,
});

describe('horariosDoDia', () => {
  it('vai das 07:00 às 21:00, de 30 em 30 minutos, em 24 h', () => {
    const slots = horariosDoDia(QUINTA, 60, [], AGORA);
    expect(slots[0].rotulo).toBe('07:00');
    expect(slots[1].rotulo).toBe('07:30');
    expect(slots[slots.length - 1].rotulo).toBe('21:00');
    expect(slots).toHaveLength(29);
  });

  it('hoje, não mostra o que já passou', () => {
    const slots = horariosDoDia(new Date(2026, 8, 30), 60, [], AGORA);
    expect(slots[0].rotulo).toBe('14:30');
  });

  it('marca como ocupado o horário que encosta numa visita, com o nome do cliente', () => {
    const slots = horariosDoDia(QUINTA, 60, [visita(15, 0, 60)], AGORA);
    const por = (r: string) => slots.find(s => s.rotulo === r)!;
    expect(por('14:30').ocupadoPor).toBe('Leonardo Teste'); // 14:30–15:30 encosta
    expect(por('15:00').ocupadoPor).toBe('Leonardo Teste');
    expect(por('15:30').ocupadoPor).toBe('Leonardo Teste');
  });

  // Foco de revisão 5.
  it('visitas que só encostam não ocupam', () => {
    const slots = horariosDoDia(QUINTA, 60, [visita(15, 0, 60)], AGORA);
    expect(slots.find(s => s.rotulo === '14:00')!.ocupadoPor).toBeNull(); // termina 15:00
    expect(slots.find(s => s.rotulo === '16:00')!.ocupadoPor).toBeNull(); // começa quando a outra termina
  });

  it('duração em branco conta como 1 h', () => {
    const slots = horariosDoDia(QUINTA, 30, [visita(10, 0, null)], AGORA);
    expect(slots.find(s => s.rotulo === '10:30')!.ocupadoPor).toBe('Leonardo Teste');
    expect(slots.find(s => s.rotulo === '11:00')!.ocupadoPor).toBeNull();
  });

  it('a duração escolhida pesa: 2 h às 13:30 encosta na visita das 15:00', () => {
    const slots = horariosDoDia(QUINTA, 120, [visita(15, 0, 60)], AGORA);
    expect(slots.find(s => s.rotulo === '13:30')!.ocupadoPor).toBe('Leonardo Teste');
    expect(slots.find(s => s.rotulo === '13:00')!.ocupadoPor).toBeNull();
  });
});

describe('ocupando', () => {
  it('deixa de fora cancelada (pela situação ou pela data), realizada e não compareceu', () => {
    const lista = [
      visita(9, 0, 60),
      visita(10, 0, 60, { status: 'cancelled' }),
      visita(11, 0, 60, { cancelled_at: '2026-09-30T10:00:00Z' }),
      visita(12, 0, 60, { status: 'completed' }),
      visita(13, 0, 60, { status: 'no_show' }),
      visita(14, 0, 60, { status: 'rescheduled' }),
    ];
    expect(ocupando(lista).map(v => v.id)).toEqual(['90', '140']);
  });
});

describe('atalhosDeDia', () => {
  it('Hoje, Amanhã e o próximo sábado', () => {
    const a = atalhosDeDia(AGORA);
    expect(a.map(x => x.rotulo)).toEqual(['Hoje', 'Amanhã', 'Sábado']);
    expect(diaISO(a[2].dia)).toBe('2026-10-03');
  });

  it('na sexta, amanhã já é sábado: não repete', () => {
    const a = atalhosDeDia(new Date(2026, 9, 2, 9, 0));
    expect(a.map(x => x.rotulo)).toEqual(['Hoje', 'Amanhã', 'Sábado']);
    expect(diaISO(a[2].dia)).toBe('2026-10-10');
  });

  it('no sábado, o atalho é o sábado seguinte', () => {
    const a = atalhosDeDia(new Date(2026, 9, 3, 9, 0));
    expect(diaISO(a[2].dia)).toBe('2026-10-10');
  });
});

describe('porExtenso e rotuloDuracao', () => {
  it('escreve o dia da semana, o mês e o intervalo', () => {
    expect(porExtenso(new Date(2026, 9, 9, 9, 0), 60)).toBe('Sexta, 9 de outubro, das 9h às 10h');
    expect(porExtenso(new Date(2026, 9, 1, 14, 30), 90)).toBe('Quinta, 1 de outubro, das 14h30 às 16h');
  });

  it('rótulos de duração', () => {
    expect([30, 60, 90, 120].map(rotuloDuracao)).toEqual(['30 min', '1 h', '1h30', '2 h']);
  });
});
