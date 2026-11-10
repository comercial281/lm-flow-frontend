import { describe, expect, it } from 'vitest';
import {
  avisoForaDoHorario,
  comecaEm,
  lerInicio,
  lerLimite,
  proximoHorarioComercial,
  voltaQuando,
} from './agenda';

// Hora de São Paulo = UTC-3. Terça-feira 20/10/2026, 10h em São Paulo.
const sp = (local: string) => new Date(`${local}-03:00`);
const TERCA_10H = sp('2026-10-20T10:00:00');

describe('proximoHorarioComercial (igual ao servidor)', () => {
  it('dentro do horário, é o próprio horário', () => {
    expect(proximoHorarioComercial(TERCA_10H)).toEqual(TERCA_10H);
  });
  it('antes das 8h num dia de semana vai pras 8h do mesmo dia', () => {
    expect(proximoHorarioComercial(sp('2026-10-20T07:15:00'))).toEqual(sp('2026-10-20T08:00:00'));
  });
  it('depois das 20h de sexta vai pro sábado às 9h', () => {
    expect(proximoHorarioComercial(sp('2026-10-23T20:00:00'))).toEqual(sp('2026-10-24T09:00:00'));
  });
  it('sábado depois das 18h e domingo vão pra segunda às 8h', () => {
    expect(proximoHorarioComercial(sp('2026-10-24T18:30:00'))).toEqual(sp('2026-10-26T08:00:00'));
    expect(proximoHorarioComercial(sp('2026-10-25T11:00:00'))).toEqual(sp('2026-10-26T08:00:00'));
  });
});

describe('lerInicio', () => {
  it('monta o ISO com o fuso de São Paulo', () => {
    expect(lerInicio('2026-12-24', '09:00', TERCA_10H)).toEqual({
      iso: '2026-12-24T09:00:00-03:00',
      data: sp('2026-12-24T09:00:00'),
      erro: '',
    });
  });
  it('sem data ou hora pede as duas', () => {
    expect(lerInicio('', '09:00', TERCA_10H).erro).toBe('Escolha a data e a hora.');
    expect(lerInicio('2026-12-24', '', TERCA_10H).erro).toBe('Escolha a data e a hora.');
  });
  it('no passado (ou agora) não vale', () => {
    expect(lerInicio('2026-10-20', '09:59', TERCA_10H).erro).toBe('Escolha uma data e hora no futuro.');
    expect(lerInicio('2026-10-20', '10:00', TERCA_10H).erro).toBe('Escolha uma data e hora no futuro.');
  });
  it('mais de 1 ano à frente não vale', () => {
    expect(lerInicio('2027-10-21', '10:00', TERCA_10H).erro).toBe('Escolha uma data e hora até um ano à frente.');
    expect(lerInicio('2027-10-19', '10:00', TERCA_10H).erro).toBe('');
  });
});

describe('lerLimite', () => {
  it('aceita inteiro de 1 a 1000', () => {
    expect(lerLimite('20')).toBe(20);
    expect(lerLimite('1')).toBe(1);
    expect(lerLimite('1000')).toBe(1000);
  });
  it('recusa zero, acima de 1000, vazio e quebrado', () => {
    for (const t of ['0', '1001', '', '2,5', '-3', 'vinte']) expect(lerLimite(t)).toBeNull();
  });
});

describe('avisoForaDoHorario', () => {
  it('domingo diz que começa às 8h de segunda', () => {
    expect(avisoForaDoHorario(sp('2026-12-27T10:00:00'), TERCA_10H)).toBe(
      'Fora do horário comercial: começa às 8h de segunda, 28/12.',
    );
  });
  it('sexta à noite diz que começa às 9h de sábado', () => {
    expect(avisoForaDoHorario(sp('2026-12-25T21:00:00'), TERCA_10H)).toBe(
      'Fora do horário comercial: começa às 9h de sábado, 26/12.',
    );
  });
  it('dentro do horário não avisa', () => {
    expect(avisoForaDoHorario(sp('2026-12-24T09:00:00'), TERCA_10H)).toBeNull();
  });
});

describe('comecaEm e voltaQuando', () => {
  it('"24/12 às 09:00", e fora do horário mostra quando começa de verdade', () => {
    expect(comecaEm('2026-12-24T09:00:00-03:00', TERCA_10H)).toBe('24/12 às 09:00');
    expect(comecaEm('2026-12-27T10:00:00-03:00', TERCA_10H)).toBe('28/12 às 08:00');
    expect(comecaEm('2027-01-05T09:30:00-03:00', TERCA_10H)).toBe('05/01/2027 às 09:30');
  });
  it('"amanhã às 8h", dia da semana e data', () => {
    expect(voltaQuando('2026-10-21T11:00:00Z', TERCA_10H)).toBe('amanhã às 8h');
    expect(voltaQuando('2026-10-24T12:00:00Z', TERCA_10H)).toBe('sábado às 9h');
    expect(voltaQuando('2026-11-02T11:00:00Z', TERCA_10H)).toBe('em 02/11 às 8h');
  });
  it('data que não é data não quebra', () => {
    expect(comecaEm('lixo')).toBeNull();
    expect(voltaQuando('lixo')).toBeNull();
  });
});
