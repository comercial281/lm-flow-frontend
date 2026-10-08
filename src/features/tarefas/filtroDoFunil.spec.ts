import { describe, expect, it } from 'vitest';
import { passaNoFiltroDeTarefas } from './filtroDoFunil';

describe('filtro de tarefas do funil', () => {
  const item = (overdue: number, hoje: number) => ({ tasks_info: { overdue_count: overdue, due_today_count: hoje } });
  it('nenhum deixa tudo passar, até cartão sem tasks_info', () => {
    expect(passaNoFiltroDeTarefas({}, 'nenhum')).toBe(true);
  });
  it('atrasadas e vence hoje olham a contagem do cartão', () => {
    expect(passaNoFiltroDeTarefas(item(1, 0), 'atrasadas')).toBe(true);
    expect(passaNoFiltroDeTarefas(item(0, 1), 'atrasadas')).toBe(false);
    expect(passaNoFiltroDeTarefas(item(0, 1), 'hoje')).toBe(true);
    expect(passaNoFiltroDeTarefas({ tasks_info: null }, 'hoje')).toBe(false);
  });
});
