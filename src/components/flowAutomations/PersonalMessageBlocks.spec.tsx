import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Automações por cargo (F5): a mensagem do corretor sai pelo WhatsApp dele.

const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import { FlowNodePanel } from './FlowNodePanel';
import { sendFromLine } from './FlowNodeCard';
import type { AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';

const followupFlows = [
  { id: 'f1', name: 'Follow-up do corretor', is_enabled: true },
] as unknown as FlowAutomation[];

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows, users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

beforeEach(() => {
  sendNumbers.mockReset();
  sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });
});

describe('Mensagem do corretor', () => {
  it('mostra "Sai pelo seu WhatsApp (número)" no lugar do "Enviar pelo número" e grava owner', async () => {
    const onSave = vi.fn();
    render(
      <FlowNodePanel
        node={node({ config: { text: 'Oi', sender_instance: 'x' } })}
        resources={resources} onClose={() => {}} onSave={onSave}
        pessoal numeroPessoal="5511987654321"
      />,
    );
    expect(screen.getByText(/Sai pelo seu WhatsApp/)).toBeTruthy();
    expect(screen.getByText(/\(11\) 98765-4321/)).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const cfg = onSave.mock.calls[0][1].config as Record<string, unknown>;
    expect(cfg.send_from).toBe('owner');
    expect(cfg.send_from_inbox_id).toBe('');
    expect(cfg.sender_instance).toBeUndefined();
  });

  it('follow-up do corretor lista só o que veio do serviço', () => {
    render(
      <FlowNodePanel
        node={node({ kind: 'lead_action', config: { action_type: 'start_followup_flow', params: {} } })}
        resources={resources} onClose={() => {}} onSave={() => {}}
        pessoal numeroPessoal="5511987654321"
      />,
    );
    expect(screen.getByText('Follow-up do corretor')).toBeTruthy();
    expect(screen.queryByText('Número de envio (admin)')).toBeNull();
  });

  it('sem pessoal, o "Enviar pelo número" aparece como sempre', async () => {
    render(<FlowNodePanel node={node({ config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(await screen.findByText('Enviar pelo número')).toBeTruthy();
    expect(screen.queryByText(/Sai pelo seu WhatsApp/)).toBeNull();
  });

  it('ação de foto do corretor não tem escolha de número e grava owner', async () => {
    const onSave = vi.fn();
    render(
      <FlowNodePanel
        node={node({ kind: 'lead_action', config: { action_type: 'send_image', params: { media_url: 'https://a.com/x.png' } } })}
        resources={resources} onClose={() => {}} onSave={onSave}
        pessoal numeroPessoal="5511987654321"
      />,
    );
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const params = (onSave.mock.calls[0][1].config as { params: Record<string, unknown> }).params;
    expect(params.send_from).toBe('owner');
    expect(params.send_from_inbox_id).toBe('');
  });

  it('o cartão do bloco diz "Pelo seu WhatsApp" no fluxo pessoal', () => {
    expect(sendFromLine({}, true)).toBe('Pelo seu WhatsApp');
    expect(sendFromLine({ send_from: 'owner' }, false)).toBe('Pelo número do responsável pelo lead');
  });

  // Ajuste do dono do produto (16/10/2026): o gestor na pessoal de outra pessoa.
  it('pessoal de outra pessoa: avisa "Sai pelo WhatsApp de Ana", sem escolher número, e grava owner', async () => {
    const onSave = vi.fn();
    render(
      <FlowNodePanel
        node={node({ config: { text: 'Oi', send_from: 'number', send_from_inbox_id: '9' } })}
        resources={resources} onClose={() => {}} onSave={onSave}
        donoDoEnvio="Ana"
      />,
    );
    expect(screen.getByText('Sai pelo WhatsApp de Ana')).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const cfg = onSave.mock.calls[0][1].config as Record<string, unknown>;
    expect(cfg.send_from).toBe('owner');
    expect(cfg.send_from_inbox_id).toBe('');
    expect(sendFromLine({}, false, 'Ana')).toBe('Pelo WhatsApp de Ana');
    expect(sendFromLine({}, false, '')).toBe('Pelo WhatsApp do dono');
  });

  it('ação de envio na pessoal de outra pessoa também avisa por qual WhatsApp sai', () => {
    render(
      <FlowNodePanel
        node={node({ kind: 'lead_action', config: { action_type: 'send_image', params: { media_url: 'https://a.com/x.png' } } })}
        resources={resources} onClose={() => {}} onSave={() => {}}
        donoDoEnvio="Ana"
      />,
    );
    expect(screen.getByText('Sai pelo WhatsApp de Ana')).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
  });

  it('gestor na pessoal dele: "Sai pelo seu WhatsApp (número)" também na ação de envio', () => {
    render(
      <FlowNodePanel
        node={node({ kind: 'lead_action', config: { action_type: 'send_whatsapp_message', params: { message: 'Oi' } } })}
        resources={resources} onClose={() => {}} onSave={() => {}}
        pessoal numeroPessoal="5511987654321"
      />,
    );
    expect(screen.getByText(/Sai pelo seu WhatsApp/)).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
  });
});
