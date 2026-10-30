import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { FlowAutomationNode } from '@/types/flowAutomations';

// Organizar (29/10/2026): o botão redesenha o fluxo no jeito do Organizar
// (caminho reto, desvio embaixo), grava as posições e oferece Desfazer.

const get = vi.hoisted(() => vi.fn());
const movePositions = vi.hoisted(() => vi.fn());
const toastMessage = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, update: vi.fn(), saveFlow: vi.fn(), testRun: vi.fn(), toggle: vi.fn(), movePositions,
    personalCapabilities: vi.fn().mockResolvedValue({ tem_numero: true, numero: '5511987654321', tem_ia: true }),
    resolveNumberConflicts: vi.fn(),
  },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));
vi.mock('sonner', () => ({ toast: Object.assign(toastMessage, { error: vi.fn(), success: vi.fn() }) }));
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

const gestor = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: true, personal: false };
const mensagem = (id: string, next: string | null, x: number, y: number): FlowAutomationNode => ({
  id, kind: 'send_whatsapp', label: null, config: { text: 'Oi', send_from: 'owner', send_from_inbox_id: '' },
  next_node_id: next, next_yes_node_id: null, next_no_node_id: null, pos_x: x, pos_y: y, steps: [],
} as FlowAutomationNode);
// Arrumado à mão, torto: a segunda mensagem lá embaixo, atrás da primeira.
const flow = (patch: Record<string, unknown> = {}) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.created', conditions: [] },
  initial_node_id: 'n1', nodes: [mensagem('n1', 'n2', 500, 40), mensagem('n2', null, 100, 900)],
  team: true, owner_user_id: null, owner_name: null,
  permissions: gestor,
  ...patch,
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
  movePositions.mockReset().mockResolvedValue(undefined);
  toastMessage.mockReset();
});

describe('Organizar', () => {
  it('redesenha o fluxo em linha reta e grava as posições na hora', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Organizar/ }));
    await waitFor(() => expect(movePositions).toHaveBeenCalledTimes(1));
    expect(movePositions).toHaveBeenCalledWith('fa1', [
      { id: 'n1', pos_x: 0, pos_y: 0 },
      { id: 'n2', pos_x: 360, pos_y: 0 },
    ]);
  });

  it('Desfazer volta cada bloco pro lugar de antes', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Organizar/ }));
    await waitFor(() => expect(toastMessage).toHaveBeenCalled());
    const [texto, opcoes] = toastMessage.mock.calls[0];
    expect(texto).toBe('Fluxo organizado');
    expect(opcoes.action.label).toBe('Desfazer');
    opcoes.action.onClick();
    await waitFor(() => expect(movePositions).toHaveBeenCalledTimes(2));
    expect(movePositions).toHaveBeenLastCalledWith('fa1', [
      { id: 'n1', pos_x: 500, pos_y: 40 },
      { id: 'n2', pos_x: 100, pos_y: 900 },
    ]);
  });

  it('quem só pode ver o fluxo não tem o Organizar', async () => {
    get.mockResolvedValue(flow({ permissions: { ...gestor, can_edit: false } }));
    renderCanvas();
    expect(await screen.findByRole('textbox', { name: 'Nome do fluxo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Organizar/ })).toBeNull();
  });
});
