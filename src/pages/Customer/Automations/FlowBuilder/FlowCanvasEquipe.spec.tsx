import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações por cargo (revisão final): o gestor marca e desmarca "Da equipe"
// no cabeçalho do construtor, com a mesma pergunta da lista ao tirar. Sem dono
// também é da equipe (o selo segue o `personal` do servidor).

const get = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const toggle = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { get, update, testRun: vi.fn(), saveFlow: vi.fn(), toggle, movePositions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: toastSuccess } }));
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
const flow = (patch: Record<string, unknown> = {}) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.created', conditions: [] },
  initial_node_id: null, nodes: [],
  team: false, owner_user_id: null, owner_name: null,
  permissions: { ...gestor, personal: false },
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
  update.mockReset();
  toggle.mockReset();
  toastSuccess.mockReset();
});

describe('"Da equipe" no cabeçalho do construtor', () => {
  it('gestor: automação sem dono aparece ligada; tirar pergunta antes e usa a resposta do servidor', async () => {
    get.mockResolvedValue(flow());
    update.mockResolvedValue(flow({ owner_user_id: 'g1', owner_name: 'Gestor', permissions: { ...gestor, personal: true } }));
    renderCanvas();
    const chave = await screen.findByRole('switch', { name: 'Da equipe' });
    expect(chave.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(chave);
    expect(await screen.findByText('Tirar da equipe?')).toBeTruthy();
    expect(screen.getByText('Esta automação passa a valer só pros seus leads e a mandar pelo seu WhatsApp.')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar da equipe' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('fa1', { team: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Da equipe' }).getAttribute('aria-checked')).toBe('false'));
  });

  it('gestor: automação de outro dono avisa de quem ficam os leads', async () => {
    get.mockResolvedValue(flow({ team: true, owner_user_id: 'u2', owner_name: 'Ana' }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Da equipe' }));
    expect(await screen.findByText('Esta automação passa a valer só pros leads de Ana e a mandar pelo WhatsApp de Ana.')).toBeTruthy();
  });

  it('gestor: cancelar não muda nada', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Da equipe' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Tirar da equipe?')).toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Da equipe' }).getAttribute('aria-checked')).toBe('true');
  });

  it('gestor: marcar "Da equipe" não pergunta', async () => {
    get.mockResolvedValue(flow({ owner_user_id: 'g1', permissions: { ...gestor, personal: true } }));
    update.mockResolvedValue(flow({ team: true, owner_user_id: 'g1', permissions: { ...gestor, personal: false } }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Da equipe' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('fa1', { team: true }));
    expect(screen.queryByText('Tirar da equipe?')).toBeNull();
  });

  it('sem poder marcar: automação sem dono mostra o selo "Da equipe", sem chave', async () => {
    get.mockResolvedValue(flow({ permissions: { can_edit: false, guided: false, can_mark_team: false, can_create_blank: true, personal: false } }));
    renderCanvas();
    expect(await screen.findByText('Da equipe')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Da equipe' })).toBeNull();
  });
});

// Follow-up: uma porta só (Fase 2): a chave Ligado/Desligado do cabeçalho
// também avisa quantos leads saem ao desligar um follow-up com gente dentro.
describe('chave Ligado do follow-up no cabeçalho', () => {
  const followup = (patch: Record<string, unknown> = {}) => flow({ kind: 'followup', is_enabled: true, live_count: 4, name: 'Pós-visita', ...patch });

  it('desligar com leads dentro pede confirmação com a contagem e depois desliga', async () => {
    get.mockResolvedValue(followup());
    toggle.mockResolvedValue(followup({ is_enabled: false, stopped_count: 4, remaining: 0 }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ligar o fluxo' }));
    expect(await screen.findByText('Desligar "Pós-visita"?')).toBeTruthy();
    expect(screen.getByText('4 leads vão sair do follow-up e os cards saem da coluna Follow-up.')).toBeTruthy();
    expect(toggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('fa1'));
  });

  it('sem leads dentro desliga direto; sobra lead saindo mostra o aviso', async () => {
    get.mockResolvedValue(followup({ live_count: 0 }));
    toggle.mockResolvedValue(followup({ is_enabled: false, stopped_count: 0, remaining: 2 }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ligar o fluxo' }));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('fa1'));
    expect(screen.queryByText('Desligar "Pós-visita"?')).toBeNull();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Desligado. 2 leads ainda saindo do follow-up; o sistema termina em seguida.'));
  });

  it('automação comum desliga direto, mesmo com live_count', async () => {
    get.mockResolvedValue(flow({ is_enabled: true, live_count: 4 }));
    toggle.mockResolvedValue(flow({ is_enabled: false }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ligar o fluxo' }));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('fa1'));
  });
});
