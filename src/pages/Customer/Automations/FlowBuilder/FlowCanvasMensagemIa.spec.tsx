import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { FlowAutomationNode } from '@/types/flowAutomations';

// Salvar do topo com fluxo ligado (11/11/2026):
// Entrega 4: o fluxo da equipe fala com o lead por UM número, escolhido nas
// Configurações. Fluxo antigo (sem a regra salva) que ninguém mexeu nas
// Configurações salva igual a hoje: sem send_from e sem tocar as Mensagens.

const get = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const sendNumbers = vi.hoisted(() => vi.fn());
const personalCapabilities = vi.hoisted(() => vi.fn());
const resolverConflitos = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, update, saveFlow, personalCapabilities, resolveNumberConflicts: resolverConflitos, testRun: vi.fn(), toggle: vi.fn(), movePositions: vi.fn(), aiMessageLeads: vi.fn().mockResolvedValue([]),
  },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => resource === 'flow_automations' && action !== 'own',
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'g1' } }),
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/features/flowAutomations/editores/LeadAutomationsEditors')>();
  const resources = {
    labels: [], followupFlows: [], users: [], pipelines: [],
    stagesByPipeline: {}, quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
    reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
  };
  return { ...original, useAutomationResources: () => resources };
});

import FlowAutomationCanvas from './FlowAutomationCanvas';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
});

const gestor = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: true };
const bloco = (config: Record<string, unknown>): FlowAutomationNode => ({
  id: 'n1', kind: 'ai_message', label: null, config,
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 100, steps: [],
} as FlowAutomationNode);
const flow = (ligado: boolean, config: Record<string, unknown>) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: ligado, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.created', conditions: [] },
  initial_node_id: 'n1', nodes: [bloco(config)],
  team: true, owner_user_id: null, owner_name: null,
  permissions: { ...gestor, personal: false },
});

const renderCanvas = () =>
  render(
    <MemoryRouter initialEntries={['/automations/fa1']}>
      <Routes>
        <Route path="/automations/:id" element={<FlowAutomationCanvas />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  update.mockReset().mockImplementation(async () => flow(true, {}));
  saveFlow.mockReset();
  toastError.mockReset();
  sendNumbers.mockReset().mockResolvedValue({ number_owner_rule: false, numbers: [] });
  personalCapabilities.mockReset().mockResolvedValue({ tem_numero: true, numero: '5511987654321', tem_ia: true });
});

async function salvarDoTopo() {
  await screen.findByRole('textbox', { name: 'Nome do fluxo' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome do fluxo' }), { target: { value: 'Boas-vindas 2' } });
  fireEvent.click(await screen.findByRole('button', { name: /Salvar/ }));
}

describe('Salvar do topo com a Mensagem com IA', () => {
  it('fluxo ligado + bloco incompleto: avisa, abre o bloco e não chama o servidor', async () => {
    get.mockResolvedValue(flow(true, { instruction: '', fallback_text: '' }));
    renderCanvas();
    await salvarDoTopo();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'Fluxo ligado: complete o bloco "Mensagem com IA" antes de salvar (Escreva a instrução.)',
    ));
    expect(update).not.toHaveBeenCalled();
    expect(saveFlow).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('fluxo desligado com o mesmo bloco incompleto salva normalmente', async () => {
    get.mockResolvedValue(flow(false, { instruction: '', fallback_text: '' }));
    saveFlow.mockImplementation(async () => flow(false, { instruction: '', fallback_text: '' }));
    renderCanvas();
    await salvarDoTopo();
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });
});
