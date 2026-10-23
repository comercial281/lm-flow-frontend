import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Follow-up por usuário (Fase 3, 21/10/2026): o corretor (só as chaves dos
// funis de mensagem) abre o follow-up DELE no modo guiado, como o funil, e o
// da equipe só pra ver. O follow-up pessoal sai sempre "pelo número do
// responsável" (o servidor manda): a regra de número da automação pessoal
// ("Sai pelo seu WhatsApp", "Indisponível") não vale aqui.

const get = vi.hoisted(() => vi.fn());
const personalCapabilities = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, personalCapabilities, update: vi.fn(), duplicate: vi.fn(), testRun: vi.fn(), saveFlow: vi.fn(), toggle: vi.fn(), movePositions: vi.fn(),
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
// Corretor de fábrica: só message_funnels.* (sem as chaves do follow-up nem das automações).
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string) => resource === 'message_funnels',
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1' } }),
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/features/flowAutomations/editores/LeadAutomationsEditors')>();
  const resources = {
    labels: [], sequences: [], followupFlows: [], users: [], pipelines: [],
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

const mensagem = {
  id: 'n1', kind: 'send_whatsapp', label: 'Primeira mensagem', config: { text: 'Oi {{nome}}' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 100, steps: [],
};
const followup = (patch: Record<string, unknown> = {}) => ({
  id: 'f1', name: 'Meu follow-up', kind: 'followup', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 0, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.stage_changed', conditions: [] },
  initial_node_id: 'n1', nodes: [mensagem],
  team: false, owner_user_id: 'u1', owner_name: 'Corretor', live_count: 0, my_default: false, account_default: false,
  permissions: { can_edit: true, guided: true, can_mark_team: false, can_create_blank: false, personal: true },
  ...patch,
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
  personalCapabilities.mockReset();
  personalCapabilities.mockResolvedValue({ tem_numero: false, numero: null, tem_ia: false });
});

describe('canvas do follow-up pro corretor', () => {
  it('canvas de follow-up abre pra corretor no modo guiado', async () => {
    get.mockResolvedValue(followup());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    await waitFor(() => expect(get).toHaveBeenCalledWith('f1'));
    // Modo guiado: sem Blocos, Simular nem Configurações; salva (não é só ver).
    expect(screen.queryByRole('button', { name: /Blocos/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Simular/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Configurações/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeTruthy();
    expect(screen.queryByTestId('faixa-so-ver')).toBeNull();
    // A regra de número da automação pessoal não entra no follow-up.
    expect(personalCapabilities).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pelo WhatsApp de|Sai pelo seu WhatsApp|Pelo seu WhatsApp/)).toBeNull();
    expect(screen.queryByText(/Indisponível/)).toBeNull();
  });

  it('no painel do bloco Mensagem não escolhe número nem mexe no progresso: diz por onde sai', async () => {
    get.mockResolvedValue(followup());
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Primeira mensagem'));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByText('Sai pelo WhatsApp do responsável pelo lead.')).toBeTruthy();
    expect(within(janela).queryByLabelText('Enviar pelo número')).toBeNull();
    expect(within(janela).queryByText('Marcar progresso')).toBeNull();
  });

  it('o da equipe abre só pra ver, com o texto do follow-up', async () => {
    get.mockResolvedValue(followup({
      owner_user_id: null, owner_name: null,
      permissions: { can_edit: false, guided: false, can_mark_team: false, can_create_blank: false, personal: false },
    }));
    renderCanvas();
    const faixa = await screen.findByTestId('faixa-so-ver');
    expect(faixa.textContent).toBe('Este follow-up é da equipe: só o gestor edita. Duplique pra ter a sua cópia.');
    expect(screen.queryByRole('button', { name: /^Salvar$/ })).toBeNull();
    // Sem dono também é da equipe: o selo aparece.
    expect(screen.getByText('Da equipe')).toBeTruthy();
  });
});
