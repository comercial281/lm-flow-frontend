import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Maradona, 04/11/2026: no construtor do follow-up, a condição de retomada não abre
// pra edição nem oferece excluir. A condição com outra etiqueta segue normal.

const get = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, personalCapabilities: vi.fn(), update, duplicate: vi.fn(), testRun: vi.fn(), saveFlow, toggle: vi.fn(), movePositions: vi.fn(),
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
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1' } }),
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
import { CONDICAO_AUTOMATICA_AVISO } from '@/features/flowAutomations/progress';

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

const bloco = (over: Record<string, unknown>) => ({
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 0, steps: [], ...over,
});
const retomada = bloco({ id: 'n1', kind: 'condition', label: 'Continuar da mensagem 3', config: { criterion: 'has_label', label: 'polo-msg-2' } });
const minha = bloco({ id: 'n2', kind: 'condition', label: 'Minha condição', config: { criterion: 'has_label', label: 'quente' }, pos_y: 300 });

const fluxo = (kind: string) => ({
  id: 'f1', name: 'Follow-up Polo', kind, folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 0, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.stage_changed', conditions: [] },
  initial_node_id: 'n1', nodes: [retomada, minha],
  team: true, owner_user_id: 'u1', owner_name: 'Gestor', live_count: 0, my_default: false, account_default: false,
  permissions: { can_edit: true, guided: false, can_mark_team: true, can_create_blank: false, personal: false },
});

const renderCanvas = () =>
  render(
    <MemoryRouter initialEntries={['/automations/follow-ups/f1']}>
      <Routes>
        <Route path="/automations/follow-ups/:id" element={<FlowAutomationCanvas />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(fluxo('followup'));
  saveFlow.mockReset();
  update.mockReset();
  update.mockResolvedValue({});
  saveFlow.mockResolvedValue({});
});

describe('condição de retomada no construtor do follow-up', () => {
  it('mostra o aviso e não oferece editar nem excluir', async () => {
    renderCanvas();
    expect(await screen.findByText(CONDICAO_AUTOMATICA_AVISO)).toBeTruthy();
    expect(screen.queryByLabelText('Editar Continuar da mensagem 3')).toBeNull();
    expect(screen.queryByLabelText('Excluir Continuar da mensagem 3')).toBeNull();
  });

  it('clicar nela não abre o painel', async () => {
    renderCanvas();
    fireEvent.click(await screen.findByText(CONDICAO_AUTOMATICA_AVISO));
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a condição com outra etiqueta continua abrindo', async () => {
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Minha condição'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });

  it('na automação nada é travado', async () => {
    get.mockResolvedValue(fluxo('automation'));
    renderCanvas();
    expect(await screen.findByLabelText('Editar Continuar da mensagem 3')).toBeTruthy();
    expect(screen.queryByText(CONDICAO_AUTOMATICA_AVISO)).toBeNull();
  });
});

describe('nome da etiqueta no salvar do follow-up', () => {
  const trocarNome = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    fireEvent.change(await screen.findByLabelText('Nome da etiqueta'), { target: { value: 'Polo Paulista' } });
    const janela = screen.getByRole('dialog');
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  };

  it('o Salvar do topo leva o nome novo junto dos blocos', async () => {
    get.mockResolvedValue({ ...fluxo('followup'), progress_tag_name: 'polo-copia' });
    renderCanvas();
    await trocarNome();
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(saveFlow.mock.calls[0][1]).toMatchObject({ progress_tag_name: 'polo-paulista' });
  });

  it('sem mexer no nome ele não vai', async () => {
    get.mockResolvedValue({ ...fluxo('followup'), name: 'Polo', progress_tag_name: 'polo-copia' });
    renderCanvas();
    await screen.findByText(CONDICAO_AUTOMATICA_AVISO);
    fireEvent.click(await screen.findByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(saveFlow.mock.calls[0][1]).not.toHaveProperty('progress_tag_name');
  });
});
