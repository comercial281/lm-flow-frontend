import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// "Criar tarefa" no construtor (Entrega 3): Pra quem e prazo em horas ou dias.
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));

import { ActionEditor, type AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';

const resources = {
  labels: [], sequences: [], followupFlows: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [], roletas: [],
  users: [
    { id: 'ana', name: 'Ana Souza', email: 'ana@x.com' },
    { id: 'bia', name: 'Bia Lima', email: 'bia@x.com', deactivated: true },
  ],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const acao = (params: Record<string, string | number> = {}) => ({ type: 'create_task', params });
const montar = (params?: Record<string, string | number>) => {
  const onChange = vi.fn();
  render(<ActionEditor action={acao(params)} onChange={onChange} resources={resources} />);
  return onChange;
};

describe('ação "Criar tarefa"', () => {
  it('bloco antigo abre em Responsável pelo lead com 24 horas', () => {
    montar({ title: 'Ligar', due_in_hours: 24 });
    expect(screen.getByRole('radio', { name: 'Responsável pelo lead' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Quanto tempo')).toHaveValue(24);
    expect(screen.getByRole('radio', { name: 'horas' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Vai pra quem estiver cuidando do lead na hora.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pessoa da equipe')).toBeNull();
  });

  it('Uma pessoa da equipe e a Ana gravam assignee_mode e assignee_id', () => {
    const onChange = montar({ title: 'Ligar' });
    fireEvent.click(screen.getByRole('radio', { name: 'Uma pessoa da equipe' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'create_task', params: { title: 'Ligar', assignee_mode: 'user' } });
  });

  it('lista só quem não está desativado, pelo nome', () => {
    const onChange = montar({ assignee_mode: 'user' });
    expect(screen.getByRole('option', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Bia/ })).toBeNull();
    expect(screen.queryByText(/ana@x.com/)).toBeNull();
    expect(screen.getByText('Vai sempre pra mesma pessoa, seja quem for o responsável.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pessoa da equipe'), { target: { value: 'ana' } });
    expect(onChange).toHaveBeenLastCalledWith({ type: 'create_task', params: { assignee_mode: 'user', assignee_id: 'ana' } });
  });

  it('voltar pra Responsável pelo lead tira o assignee_id', () => {
    const onChange = montar({ assignee_mode: 'user', assignee_id: 'ana' });
    fireEvent.click(screen.getByRole('radio', { name: 'Responsável pelo lead' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'create_task', params: { assignee_mode: 'lead_owner' } });
  });

  it('prazo 2 dias grava due_in_hours 48', () => {
    const onChange = montar({ due_in_hours: 1 });
    fireEvent.click(screen.getByRole('radio', { name: 'dia' }));
    fireEvent.change(screen.getByLabelText('Quanto tempo'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ type: 'create_task', params: { due_in_hours: 48 } });
  });

  it('singular na unidade e na frase', () => {
    montar({ due_in_hours: 1 });
    expect(screen.getByRole('radio', { name: 'hora' })).toBeInTheDocument();
    expect(screen.getByText('A tarefa vence 1 hora depois que o lead passar por este bloco.')).toBeInTheDocument();
  });
});
