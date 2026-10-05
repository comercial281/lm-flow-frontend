import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// "Disparar funil de mensagens" (05/10/2026): a ação escolhe um funil de
// CONVERSA (Funis de mensagem) e grava `flow_automation_id`. A ação antiga
// (`funnel_id`) continua aparecendo, marcada como "formato antigo".
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));

import { ActionEditor, formatActionSummary, type AutomationResources } from './LeadAutomationsEditors';
import { missingActionParams, type LeadAutomationAction } from '@/services/leadAutomation/leadAutomationService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { MessageFunnel } from '@/types/messageFunnels';

const funnel = (id: string, name: string, extra: Partial<FlowAutomation> = {}) =>
  ({ id, name, kind: 'conversation', is_enabled: true, guide_done: true, archived_at: null, team: false, ...extra }) as FlowAutomation;

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [],
  messageFunnels: [{ id: 'old-1', name: 'Boas-vindas antigo' } as MessageFunnel],
  conversationFunnels: [
    funnel('c1', 'Apresentação do imóvel'),
    funnel('c2', 'Pós-visita', { is_enabled: false }),
    funnel('c3', 'Primeiro contato', { team: true }),
  ],
  evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

describe('ação "Disparar funil de mensagens"', () => {
  it('lista os funis de conversa em Meus funis / Da equipe, com o estado', () => {
    render(<ActionEditor action={{ type: 'send_message_funnel', params: {} }} onChange={vi.fn()} resources={resources} />);
    expect(screen.getByRole('option', { name: 'Apresentação do imóvel' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pós-visita (desligado)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Primeiro contato' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Meus funis' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Da equipe' })).toBeInTheDocument();
  });

  it('escolher grava flow_automation_id e tira o funnel_id antigo', () => {
    const onChange = vi.fn();
    const action: LeadAutomationAction = { type: 'send_message_funnel', params: { funnel_id: 'old-1' } };
    render(<ActionEditor action={action} onChange={onChange} resources={resources} />);

    expect(screen.getByText(/formato antigo/)).toBeInTheDocument();
    expect(screen.getByText('Boas-vindas antigo')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Qual funil'), { target: { value: 'c3' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'send_message_funnel', params: { flow_automation_id: 'c3' } });
  });

  it('o resumo do cartão: funil novo pelo nome; antigo marcado', () => {
    expect(formatActionSummary({ type: 'send_message_funnel', params: { flow_automation_id: 'c1' } }, resources))
      .toBe('Funil: Apresentação do imóvel');
    expect(formatActionSummary({ type: 'send_message_funnel', params: { funnel_id: 'old-1' } }, resources))
      .toBe('Funil: Boas-vindas antigo (formato antigo)');
    expect(formatActionSummary({ type: 'send_message_funnel', params: {} }, resources)).toBe('Funil: (não definido)');
  });

  it('obrigatório: o funil novo; a ação antiga com funnel_id continua completa', () => {
    expect(missingActionParams({ type: 'send_message_funnel', params: {} })).toEqual(['flow_automation_id']);
    expect(missingActionParams({ type: 'send_message_funnel', params: { flow_automation_id: 'c1' } })).toEqual([]);
    expect(missingActionParams({ type: 'send_message_funnel', params: { funnel_id: 'old-1' } })).toEqual([]);
  });
});
