import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';

// Fase 4 (Entrega B): o follow-up do formato antigo saiu da tela. O editor de
// ação não lê mais as sequências antigas nem oferece escolher uma; o bloco que
// ainda tem a ação antiga salva abre, mas só avisa que ela não faz mais nada.
const getAll = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/services/followupSequences/followupSequencesService', () => ({ followupSequencesService: { getAll } }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/services/quickReplies/quickRepliesService', () => ({ quickRepliesService: { getQuickReplies: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({ flowAutomationsService: { list: vi.fn().mockResolvedValue([]) } }));
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

import { ActionEditor, useAutomationResources, type AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';

const resources = {
  labels: [], followupFlows: [{ id: 'f1', name: 'Follow-up longo' }], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [], roletas: [], users: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

describe('editor de ação sem a sequência antiga', () => {
  it('carregar os recursos não chama /followup_sequences', async () => {
    getAll.mockResolvedValue([{ id: 's1', slug: 'velho', name: 'Funil velho', is_active: true }]);
    const { result } = renderHook(() => useAutomationResources(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAll).not.toHaveBeenCalled();
    expect(result.current).not.toHaveProperty('sequences');
  });

  it('a ação antiga salva não oferece escolher sequência: só avisa', () => {
    render(<ActionEditor action={{ type: 'start_followup_sequence', params: { sequence_slug: 'velho' } }} onChange={vi.fn()} resources={resources} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Selecione uma sequência')).toBeNull();
    expect(screen.getByText(/formato antigo/i)).toBeInTheDocument();
    expect(screen.getByText(/Iniciar follow-up/)).toBeInTheDocument();
  });

  it('o "Iniciar follow-up" novo continua escolhendo um follow-up', () => {
    render(<ActionEditor action={{ type: 'start_followup_flow', params: {} }} onChange={vi.fn()} resources={resources} />);
    expect(screen.getByRole('option', { name: 'Follow-up longo' })).toBeInTheDocument();
  });
});
