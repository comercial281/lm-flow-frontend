import { describe, it, expect } from 'vitest';
import {
  blocosDoDia,
  diasDaSemana,
  faixaAberta,
  horaDeAbertura,
  horarioDoClique,
  limitesDaVisao,
  navegar,
  periodoDoContador,
  tituloDaVisao,
} from './gradeDoCalendario';

const v = (id: string, iso: string, duration_minutes?: number | null) => ({ id, scheduled_at: iso, duration_minutes });
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe('semana e navegação', () => {
  it('a semana vai de domingo a sábado, atravessando o mês', () => {
    const dias = diasDaSemana(new Date(2026, 9, 2)); // sexta, 2/10
    expect(dias.map(d => `${d.getDate()}/${d.getMonth() + 1}`)).toEqual(['27/9', '28/9', '29/9', '30/9', '1/10', '2/10', '3/10']);
  });

  it('limites: mês inteiro, semana e o próprio dia', () => {
    const d = new Date(2026, 9, 2, 15, 30);
    expect(limitesDaVisao('mes', d)).toEqual({ primeiro: new Date(2026, 9, 1), ultimo: new Date(2026, 9, 31) });
    expect(limitesDaVisao('semana', d)).toEqual({ primeiro: new Date(2026, 8, 27), ultimo: new Date(2026, 9, 3) });
    expect(limitesDaVisao('dia', d)).toEqual({ primeiro: new Date(2026, 9, 2), ultimo: new Date(2026, 9, 2) });
  });

  it('‹ › andam um mês, uma semana ou um dia', () => {
    const d = new Date(2026, 9, 2);
    expect(navegar('mes', d, 1)).toEqual(new Date(2026, 10, 1));
    expect(navegar('semana', d, -1)).toEqual(new Date(2026, 8, 25));
    expect(navegar('dia', d, 1)).toEqual(new Date(2026, 9, 3));
  });
});

describe('título e contador', () => {
  it('título por visão', () => {
    expect(tituloDaVisao('mes', new Date(2026, 9, 2))).toBe('Outubro 2026');
    expect(tituloDaVisao('dia', new Date(2026, 9, 2))).toBe('Sexta, 2 de outubro de 2026');
    expect(tituloDaVisao('semana', new Date(2026, 9, 7))).toBe('4 a 10 de outubro de 2026');
    expect(tituloDaVisao('semana', new Date(2026, 9, 2))).toBe('27 de setembro a 3 de outubro de 2026');
    expect(tituloDaVisao('semana', new Date(2026, 11, 31))).toBe('27 de dezembro de 2026 a 2 de janeiro de 2027');
  });

  it('período do contador: hoje, nesta semana, ou as datas', () => {
    const hoje = new Date(2026, 9, 2, 10);
    expect(periodoDoContador('mes', hoje, hoje)).toBe('em outubro');
    expect(periodoDoContador('dia', new Date(2026, 9, 2), hoje)).toBe('hoje');
    expect(periodoDoContador('dia', new Date(2026, 9, 5), hoje)).toBe('em 05/10');
    expect(periodoDoContador('semana', new Date(2026, 8, 29), hoje)).toBe('nesta semana');
    expect(periodoDoContador('semana', new Date(2026, 9, 7), hoje)).toBe('de 04/10 a 10/10');
  });
});

describe('blocosDoDia', () => {
  const dia = new Date(2026, 9, 2);

  it('posiciona pelo horário e pela duração; sem duração vale 1 h', () => {
    const [a] = blocosDoDia([v('a', local(2026, 10, 2, 16, 30), 30)], dia);
    expect(a).toMatchObject({ inicioMin: 16 * 60 + 30, duracaoMin: 30, coluna: 0, colunas: 1 });
    const [b] = blocosDoDia([v('b', local(2026, 10, 2, 9), null)], dia);
    expect(b.duracaoMin).toBe(60);
  });

  it('só as visitas do dia', () => {
    const r = blocosDoDia([v('a', local(2026, 10, 1, 10)), v('b', local(2026, 10, 2, 10)), v('c', local(2026, 10, 3, 0))], dia);
    expect(r.map(x => x.visita.id)).toEqual(['b']);
  });

  it('sobrepostas ficam lado a lado; encostar não é sobrepor', () => {
    const r = blocosDoDia([
      v('eliene', local(2026, 10, 2, 15), 60),
      v('joyce', local(2026, 10, 2, 15, 30), 60),
      v('depois', local(2026, 10, 2, 16, 30), 60),
    ], dia);
    const por = Object.fromEntries(r.map(x => [x.visita.id, x]));
    expect(por.eliene).toMatchObject({ coluna: 0, colunas: 2 });
    expect(por.joyce).toMatchObject({ coluna: 1, colunas: 2 });
    expect(por.depois).toMatchObject({ coluna: 0, colunas: 1 });
  });

  it('reaproveita a coluna que já acabou dentro do mesmo grupo', () => {
    const r = blocosDoDia([
      v('longa', local(2026, 10, 2, 10), 120),
      v('curta1', local(2026, 10, 2, 10), 30),
      v('curta2', local(2026, 10, 2, 11), 30),
    ], dia);
    const por = Object.fromEntries(r.map(x => [x.visita.id, x]));
    expect(por.longa.coluna).toBe(0);
    expect(por.curta1.coluna).toBe(1);
    expect(por.curta2.coluna).toBe(1);
    expect(r.every(x => x.colunas === 2)).toBe(true);
  });

  it('visita que passa da meia-noite é cortada no fim do dia', () => {
    const [a] = blocosDoDia([v('a', local(2026, 10, 2, 23, 30), 120)], dia);
    expect(a.duracaoMin).toBe(30);
  });
});

describe('clique, horário de visita e rolagem', () => {
  it('clique arredonda para baixo de 30 em 30', () => {
    const d = new Date(2026, 9, 2);
    expect(horarioDoClique(d, 15 * 48 + 10, 48)).toEqual(new Date(2026, 9, 2, 15, 0));
    expect(horarioDoClique(d, 15 * 48 + 30, 48)).toEqual(new Date(2026, 9, 2, 15, 30));
    expect(horarioDoClique(d, 99999, 48)).toEqual(new Date(2026, 9, 2, 23, 30));
  });

  it('faixa aberta: dia da semana sem visita e data fechada = fechado', () => {
    const ajustes = { days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: ['2026-10-12'] };
    expect(faixaAberta(new Date(2026, 9, 2), ajustes)).toEqual({ de: 480, ate: 1200 });
    expect(faixaAberta(new Date(2026, 9, 4), ajustes)).toBeNull(); // domingo
    expect(faixaAberta(new Date(2026, 9, 12), ajustes)).toBeNull();
  });

  it('abre uma hora antes da primeira visita ou do começo do horário', () => {
    expect(horaDeAbertura([])).toBe(6);
    expect(horaDeAbertura([{ inicioMin: 5 * 60 + 30 }])).toBe(4);
    expect(horaDeAbertura([{ inicioMin: 15 * 60 }], 8 * 60)).toBe(7);
  });
});
