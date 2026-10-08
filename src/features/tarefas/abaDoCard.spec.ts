import { describe, expect, it } from 'vitest';
import { rotuloDaAbaTarefas } from './abaDoCard';

describe('rótulo da aba Tarefas', () => {
  it('sem nada aberto fica só o nome', () => {
    expect(rotuloDaAbaTarefas(null, null)).toEqual({ rotulo: 'Tarefas', marcador: false });
  });
  it('antes de abrir a aba usa a contagem do cartão', () => {
    expect(rotuloDaAbaTarefas(null, { pending_count: 1, overdue_count: 2 })).toEqual({ rotulo: 'Tarefas (2)', marcador: true });
  });
  it('depois de abrir, vale o que o bloco contou', () => {
    expect(rotuloDaAbaTarefas({ abertas: 2, atrasadas: 0 }, { pending_count: 9, overdue_count: 9 })).toEqual({ rotulo: 'Tarefas (2)', marcador: false });
  });
});
