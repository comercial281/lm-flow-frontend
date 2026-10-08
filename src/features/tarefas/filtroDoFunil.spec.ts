import { describe, expect, it } from 'vitest';
import { passaNoFiltroDeTarefas, passaNoFiltroDeTarefasDoFunil } from './filtroDoFunil';

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

describe('filtro de tarefas do funil: prazo e categoria na mesma tarefa', () => {
  const AGORA = new Date(2026, 9, 7, 9, 0).getTime();
  const em = (dia: number, h = 15) => new Date(2026, 9, dia, h).toISOString();
  const cartao = (...open_tasks: { category_option_id: string | null; due_at: string | null }[]) => ({ tasks_info: { open_tasks } });

  it('vence amanhã pela contagem do servidor antigo', () => {
    expect(passaNoFiltroDeTarefas({ tasks_info: { due_tomorrow_count: 1 } }, 'amanha')).toBe(true);
    expect(passaNoFiltroDeTarefas({ tasks_info: { due_tomorrow_count: 0 } }, 'amanha')).toBe(false);
  });
  it('sem filtro nenhum, tudo passa', () => {
    expect(passaNoFiltroDeTarefasDoFunil({}, [], [], AGORA)).toBe(true);
  });
  it('prazo sozinho: atrasada, hoje e amanhã pelo dia de quem usa', () => {
    const c = cartao({ category_option_id: null, due_at: em(8, 0) });
    expect(passaNoFiltroDeTarefasDoFunil(c, ['amanha'], [], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil(c, ['hoje'], [], AGORA)).toBe(false);
    expect(passaNoFiltroDeTarefasDoFunil(cartao({ category_option_id: null, due_at: em(7, 8) }), ['atrasadas'], [], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil(cartao({ category_option_id: null, due_at: em(7, 18) }), ['hoje'], [], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil(cartao({ category_option_id: null, due_at: null }), ['hoje', 'amanha', 'atrasadas'], [], AGORA)).toBe(false);
  });
  it('categoria sozinha', () => {
    const c = cartao({ category_option_id: 'k1', due_at: null });
    expect(passaNoFiltroDeTarefasDoFunil(c, [], ['k1', 'k9'], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil(c, [], ['k2'], AGORA)).toBe(false);
    expect(passaNoFiltroDeTarefasDoFunil(cartao({ category_option_id: null, due_at: null }), [], ['k1'], AGORA)).toBe(false);
  });
  it('combinados valem na MESMA tarefa, não em tarefas diferentes', () => {
    const separadas = cartao({ category_option_id: 'k1', due_at: em(9) }, { category_option_id: 'k2', due_at: em(6) });
    expect(passaNoFiltroDeTarefasDoFunil(separadas, ['atrasadas'], ['k1'], AGORA)).toBe(false);
    expect(passaNoFiltroDeTarefasDoFunil(separadas, ['atrasadas'], ['k2'], AGORA)).toBe(true);
  });
  it('sem tarefa aberta (as concluídas não vêm) não passa quando há filtro', () => {
    expect(passaNoFiltroDeTarefasDoFunil(cartao(), ['hoje'], [], AGORA)).toBe(false);
    expect(passaNoFiltroDeTarefasDoFunil(cartao(), [], ['k1'], AGORA)).toBe(false);
  });
  it('servidor antigo (sem open_tasks): usa as contagens e deixa a categoria passar', () => {
    const velho = { tasks_info: { overdue_count: 1, due_today_count: 0, due_tomorrow_count: 0 } };
    expect(passaNoFiltroDeTarefasDoFunil(velho, ['atrasadas'], ['k1'], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil(velho, ['amanha'], [], AGORA)).toBe(false);
    expect(passaNoFiltroDeTarefasDoFunil(velho, [], ['k1'], AGORA)).toBe(true);
    expect(passaNoFiltroDeTarefasDoFunil({ tasks_info: null }, ['hoje'], [], AGORA)).toBe(false);
  });
});
