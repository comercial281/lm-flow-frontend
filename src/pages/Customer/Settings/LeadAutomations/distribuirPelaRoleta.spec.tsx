import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// "Distribuir pela roleta" (06/10/2026): a ação ESCOLHE a roleta e grava
// `roleta_config_id` (o servidor aceita desde os consertos da roleta), e ela é
// obrigatória (a roleta não tem número). Vale na regra e no bloco do construtor
// (o mesmo editor e a mesma régua).
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));

import { ActionEditor, formatActionSummary, validateRule, type AutomationResources } from './LeadAutomationsEditors';
import { missingActionParams } from '@/services/leadAutomation/leadAutomationService';
import { leadActionProblem } from '@/features/flowAutomations/leadAction';
import { enableProblem } from '@/features/flowAutomations/readiness';
import type { RoletaConfig } from '@/services/roletaConfig/roletaConfigService';

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  roletas: [
    { id: 'r1', name: 'Zona Sul', is_active: true },
    { id: 'r2', name: 'Antiga', is_active: false },
  ] as RoletaConfig[],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

const acao = (params: Record<string, string> = {}) => ({ type: 'assign_via_roleta', params });

describe('ação "Distribuir pela roleta"', () => {
  it('lista as roletas ligadas e grava roleta_config_id', () => {
    const onChange = vi.fn();
    render(<ActionEditor action={acao()} onChange={onChange} resources={resources} />);
    expect(screen.getByRole('option', { name: 'Zona Sul' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Antiga/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Roleta'), { target: { value: 'r1' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'assign_via_roleta', params: { roleta_config_id: 'r1' } });
  });

  it('a escolhida e desligada continua na lista', () => {
    render(<ActionEditor action={acao({ roleta_config_id: 'r2' })} onChange={vi.fn()} resources={resources} />);
    expect(screen.getByLabelText('Roleta')).toHaveValue('r2');
    expect(screen.getByRole('option', { name: 'Antiga (desligada)' })).toBeInTheDocument();
  });

  it('a roleta é obrigatória na regra e no bloco do construtor', () => {
    render(<ActionEditor action={acao()} onChange={vi.fn()} resources={resources} />);
    expect(screen.getByText('Oferece o lead ao próximo da fila da roleta escolhida. Funciona com lead sem conversa.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Escolha a roleta' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'A roleta do número da conversa' })).toBeNull();

    expect(missingActionParams(acao())).toEqual(['roleta_config_id']);
    expect(missingActionParams(acao({ roleta_config_id: 'r1' }))).toEqual([]);
    expect(validateRule('lead.created', [], [acao()]))
      .toEqual({ ok: false, error: 'Escolha a roleta na ação "Distribuir pela roleta".' });
    expect(leadActionProblem({ action_type: 'assign_via_roleta', params: {} })).toBe('Falta preencher a roleta.');
    const bloco = { kind: 'lead_action' as const, config: { action_type: 'assign_via_roleta', params: {} }, label: null };
    expect(enableProblem({ event: 'lead.created' } as never, [bloco], 'conversation'))
      .toBe('Antes de ligar, complete o bloco "Distribuir pela roleta": falta preencher a roleta.');
  });

  it('o resumo do cartão diz qual roleta', () => {
    expect(formatActionSummary(acao({ roleta_config_id: 'r1' }), resources)).toBe('Roleta: Zona Sul');
    expect(formatActionSummary(acao(), resources)).toBe('Roleta do número da conversa');
  });
});
