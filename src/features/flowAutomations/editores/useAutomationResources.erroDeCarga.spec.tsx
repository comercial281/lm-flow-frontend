import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const s = vi.hoisted(() => ({ labels: vi.fn(), pipelines: vi.fn(), users: vi.fn() }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: s.labels } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: s.pipelines, getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: s.users } }));
vi.mock('@/services/quickReplies/quickRepliesService', () => ({ quickRepliesService: { getQuickReplies: vi.fn().mockResolvedValue({ data: [] }) } }));
const listaDeFluxos = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({ flowAutomationsService: { list: listaDeFluxos } }));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({ messageFunnelsService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({ roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/leadAutomation/leadAutomationService', async orig => {
  const real = await orig<typeof import('@/services/leadAutomation/leadAutomationService')>();
  return {
    ...real,
    leadAutomationService: {
      ...real.leadAutomationService,
      getAdOrigins: vi.fn().mockResolvedValue([]),
      getFormOrigins: vi.fn().mockResolvedValue([]),
      getEvolutionInstances: vi.fn().mockResolvedValue([]),
    },
  };
});

import { ConditionEditor, useAutomationResources, type AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { FlowNodePanel } from '@/components/flowAutomations/FlowNodePanel';
import type { FlowAutomationNode } from '@/types/flowAutomations';

beforeEach(() => {
  listaDeFluxos.mockReset().mockResolvedValue([]);
  s.labels.mockReset().mockResolvedValue({ data: [{ id: 1, title: 'quente' }] });
  s.pipelines.mockReset().mockResolvedValue({ data: [] });
  s.users.mockReset().mockResolvedValue({ data: [{ id: 'u1', name: 'Ana' }] });
});

describe('useAutomationResources · erro de carga', () => {
  it('lista que falha vira erro, sem apagar as que carregaram; recarregar recupera', async () => {
    s.labels.mockRejectedValueOnce(new Error('rede'));
    const { result } = renderHook(() => useAutomationResources(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.erro).toBe(true);
    expect(result.current.erros?.labels).toBe(true);
    expect(result.current.erros?.users).toBe(false);
    expect(result.current.users).toHaveLength(1);

    await act(async () => { result.current.recarregar?.(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.erro).toBe(false);
    expect(result.current.labels).toHaveLength(1);
  });

  it('durante o Tentar de novo o erro antigo sai da tela (não fica "Não deu pra carregar" enquanto recarrega)', async () => {
    s.labels.mockRejectedValueOnce(new Error('rede'));
    const { result } = renderHook(() => useAutomationResources(true));
    await waitFor(() => expect(result.current.erros?.labels).toBe(true));
    let soltar: (v: unknown) => void = () => {};
    s.labels.mockReturnValueOnce(new Promise(r => { soltar = r; }));
    await act(async () => { result.current.recarregar?.(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.erro).toBe(false);
    await act(async () => { soltar({ data: [{ id: 1, title: 'quente' }] }); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.erro).toBe(false);
  });

  it('recarregar duas vezes seguidas fica com uma lista só (resposta antiga é ignorada)', async () => {
    s.users.mockRejectedValueOnce(new Error('rede'));
    const { result } = renderHook(() => useAutomationResources(true));
    await waitFor(() => expect(result.current.erros?.users).toBe(true));
    await act(async () => { result.current.recarregar?.(); result.current.recarregar?.(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users).toHaveLength(1);
    expect(result.current.erro).toBe(false);
  });
});

const base = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

describe('editores · erro de carga', () => {
  it('formulários: erro mostra Tentar de novo (que recarrega), não "Nenhum formulário conectado"', async () => {
    const recarregar = vi.fn();
    const resources = { ...base, erro: true, erros: { formOrigins: true }, recarregar } as unknown as AutomationResources;
    render(<ConditionEditor trigger="lead.created" condition={{ field: 'source', operator: 'eq', value: 'formulario' }} onChange={() => {}} resources={resources} />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum formulário/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('bloco de etiqueta do fluxo: erro nas etiquetas mostra Tentar de novo, não "Nenhuma etiqueta"', async () => {
    const recarregar = vi.fn();
    const resources = { ...base, erro: true, erros: { labels: true }, recarregar } as unknown as AutomationResources;
    const node = { id: 'n1', kind: 'add_label', label: null, config: {}, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] } as unknown as FlowAutomationNode;
    render(<FlowNodePanel node={node} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma etiqueta/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});

// Fase 3 (22/10/2026): o bloco "Iniciar follow-up" lista o que o servidor manda pra AQUELA automação.
describe('useAutomationResources · follow-ups do bloco Iniciar follow-up', () => {
  it('bloco da automação da equipe lista só equipe', async () => {
    listaDeFluxos.mockImplementation(async (params: { kind?: string; startable?: boolean }) =>
      params.kind === 'followup' && params.startable
        ? [{ id: 'fu-equipe', name: 'Follow-up da casa', is_enabled: true, archived_at: null, team: true }]
        : []);
    const { result } = renderHook(() => useAutomationResources(true, 'auto-da-equipe'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(listaDeFluxos).toHaveBeenCalledWith({ kind: 'followup', startable: true, automationId: 'auto-da-equipe' });
    expect(result.current.followupFlows.map(f => f.id)).toEqual(['fu-equipe']);
  });
});
