import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list } }));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() }, flowAutomationFoldersService: {},
}));

import { FlowNodePanel } from './FlowNodePanel';
import type { AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import type { FlowAutomationNode } from '@/types/flowAutomations';

const resources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const node = (config: Record<string, unknown> = {}): FlowAutomationNode => ({
  id: 'n1', kind: 'hand_to_ai', label: null, config,
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
});
const agente = (id: string, name: string, position: number, inbox_id = 'i1') => ({
  id, name, enabled: true, inbox_id, followup_only: false, absorbed_into_id: null,
  numbers: [{ inbox_id, position, enabled: true }],
});

beforeEach(() => list.mockReset());

describe('Passar para a IA · escolha do agente', () => {
  it('número dividido sem escolha mostra "Escolha qual agente atende" e grava o id escolhido', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0), agente('b', 'Agente B', 1)]);
    const onSave = vi.fn();
    render(<FlowNodePanel node={node()} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(await screen.findByText('Escolha qual agente atende')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Agente B' }));
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config.sales_agent_id).toBe('b');
  });

  it('bloco já com a escolha vem marcado', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0), agente('b', 'Agente B', 1)]);
    render(<FlowNodePanel node={node({ sales_agent_id: 'a' })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    const radio = await screen.findByRole('radio', { name: 'Agente A' });
    expect(radio.getAttribute('aria-checked')).toBe('true');
  });

  it('com um agente só, o bloco grava o id dele e a escolha some', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0)]);
    const onSave = vi.fn();
    render(<FlowNodePanel node={node()} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(await screen.findByText(/Agente A/)).toBeTruthy();
    expect(screen.queryByText('Escolha qual agente atende')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    await act(async () => {}); // o efeito que grava o id do agente único
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config.sales_agent_id).toBe('a');
  });

  it('vários agentes em números diferentes (nenhum dividido): sem escolha, o bloco segue como sempre', async () => {
    list.mockResolvedValue([agente('a', 'Agente A', 0, 'i1'), agente('b', 'Agente B', 0, 'i2')]);
    const onSave = vi.fn();
    render(<FlowNodePanel node={node()} resources={resources} onClose={() => {}} onSave={onSave} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.queryByText('Escolha qual agente atende')).toBeNull();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config.sales_agent_id).toBeUndefined();
  });
});
