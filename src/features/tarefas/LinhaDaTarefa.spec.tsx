import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinhaDaTarefa from './LinhaDaTarefa';
import type { TarefaAtividade } from './tipos';

const base: TarefaAtividade = {
  kind: 'task', id: 't1', title: 'Ligar pra confirmar documentos', category: 'Ligação', category_option_id: 'c1',
  due_at: new Date(Date.now() + 60 * 60_000).toISOString(), status: 'pending', overdue: false,
  pipeline_item_id: 'card-1', pipeline_id: 'p1', contact: { id: 'x', name: 'Mariana Costa' }, assignee: { id: 'u', name: 'Paty Souza' },
  created_by_id: 'u', can_edit: true, can_delete: true,
};
const acoes = { aoConcluir: vi.fn(), aoReabrir: vi.fn(), aoEditar: vi.fn(), aoExcluir: vi.fn() };
const desenhar = (extra: Partial<TarefaAtividade> = {}, props: { mostrarLead?: boolean; aoAbrir?: () => void } = {}) =>
  render(<ul><LinhaDaTarefa tarefa={{ ...base, ...extra }} {...acoes} {...props} /></ul>);

describe('LinhaDaTarefa (cartão C, 14/10/2026)', () => {
  it('na tela Tarefas mostra o lead, o tipo, o imóvel e o responsável na segunda linha', () => {
    desenhar({ property: { id: 'i', title: 'Apto', code: 'AP0566' } }, { mostrarLead: true });
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument();
    expect(screen.getByText(/Ligação · AP0566 · Paty Souza/)).toBeInTheDocument();
  });

  it('dentro do card não repete o lead', () => {
    desenhar();
    expect(screen.queryByText('Mariana Costa')).not.toBeInTheDocument();
  });

  it('não repete o tipo quando o título é o próprio tipo', () => {
    desenhar({ title: 'Follow-up', category: 'Follow-up', assignee: null });
    expect(screen.getAllByText('Follow-up')).toHaveLength(1);
  });

  it('atrasada diz há quanto tempo', () => {
    desenhar({ overdue: true, due_at: new Date(Date.now() - 5 * 60 * 60_000).toISOString() });
    expect(screen.getByText('Atrasada há 5 h')).toBeInTheDocument();
  });

  it('concluída não aparece como atrasada', () => {
    desenhar({ overdue: true, status: 'completed', due_at: new Date(Date.now() - 5 * 60 * 60_000).toISOString() });
    expect(screen.queryByText(/Atrasada/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Reabrir/ })).toBeChecked();
  });

  it('prioridade alta ganha selo', () => {
    desenhar({ priority: 'high' });
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('a bolinha conclui; sem permissão fica travada', () => {
    const { unmount } = desenhar();
    fireEvent.click(screen.getByRole('checkbox', { name: /Concluir Ligar/ }));
    expect(acoes.aoConcluir).toHaveBeenCalled();
    unmount();
    desenhar({ can_edit: false });
    expect(screen.getByRole('checkbox', { name: /Concluir Ligar/ })).toBeDisabled();
  });

  it('clicar no texto abre o card', () => {
    const aoAbrir = vi.fn();
    desenhar({}, { aoAbrir });
    fireEvent.click(screen.getByText('Ligar pra confirmar documentos'));
    expect(aoAbrir).toHaveBeenCalled();
  });
});
