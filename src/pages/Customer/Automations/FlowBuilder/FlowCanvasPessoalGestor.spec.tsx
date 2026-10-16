import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Ajuste do dono do produto (16/10/2026): o gestor na automação PESSOAL dele
// tem todos os blocos, mas a mensagem sai pelo número dele ("Indisponível" sem
// número ou sem IA). Na pessoal de outra pessoa, o bloco só avisa por qual
// WhatsApp sai. E "Da equipe" não sai com bloco preso a número específico.

const get = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const personalCapabilities = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, update, personalCapabilities, testRun: vi.fn(), saveFlow: vi.fn(), toggle: vi.fn(), movePositions: vi.fn(),
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
// Gestor: tem `flow_automations.update`.
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => resource === 'flow_automations' && action !== 'own',
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'g1' } }),
}));
vi.mock('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors')>();
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

const gestor = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: true };
const mensagem = {
  id: 'n1', kind: 'send_whatsapp', label: null, config: { text: 'Oi' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 100, steps: [],
};
const flow = (patch: Record<string, unknown> = {}) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.created', conditions: [] },
  initial_node_id: null, nodes: [],
  team: false, owner_user_id: 'g1', owner_name: 'Gestor',
  permissions: { ...gestor, personal: true },
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

async function abrirBlocos() {
  const botao = await screen.findByRole('button', { name: /Blocos/ });
  if (botao.getAttribute('aria-expanded') !== 'true') fireEvent.click(botao);
}

beforeEach(() => {
  get.mockReset();
  update.mockReset();
  personalCapabilities.mockReset();
});

describe('gestor na automação pessoal DELE', () => {
  it('sem número: "Mandar WhatsApp" Indisponível, mas segue com todos os blocos', async () => {
    personalCapabilities.mockResolvedValue({ tem_numero: false, numero: null, tem_ia: false });
    get.mockResolvedValue(flow());
    renderCanvas();
    await abrirBlocos();
    await waitFor(() => expect(personalCapabilities).toHaveBeenCalled());
    const mandar = await screen.findByRole('button', { name: /Mandar WhatsApp.*Indisponível/ });
    expect((mandar as HTMLButtonElement).disabled).toBe(true);
    // Bloco fora da lista do corretor continua disponível pro gestor.
    const avisar = screen.getByRole('button', { name: /Avisar no grupo/ });
    expect((avisar as HTMLButtonElement).disabled).toBe(false);
  });

  it('com número: a mensagem fica liberada', async () => {
    personalCapabilities.mockResolvedValue({ tem_numero: true, numero: '5511987654321', tem_ia: false });
    get.mockResolvedValue(flow());
    renderCanvas();
    await abrirBlocos();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Mandar WhatsApp.*Indisponível/ })).toBeNull());
    expect(screen.getAllByRole('button', { name: /Mandar WhatsApp/ }).length).toBeGreaterThan(0);
  });
});

describe('gestor na automação pessoal de OUTRA pessoa', () => {
  it('não consulta o número dele e nada fica Indisponível', async () => {
    get.mockResolvedValue(flow({ owner_user_id: 'u2', owner_name: 'Ana' }));
    renderCanvas();
    await abrirBlocos();
    expect(await screen.findByRole('button', { name: /Avisar no grupo/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Indisponível/ })).toBeNull();
    expect(personalCapabilities).not.toHaveBeenCalled();
  });

  it('o bloco de mensagem diz por qual WhatsApp sai', async () => {
    get.mockResolvedValue(flow({ owner_user_id: 'u2', owner_name: 'Ana', nodes: [mensagem], initial_node_id: 'n1' }));
    renderCanvas();
    expect(await screen.findByText('Pelo WhatsApp de Ana')).toBeTruthy();
  });
});

describe('"Da equipe" com bloco de número específico', () => {
  it('a chave fica travada e explica por quê', async () => {
    get.mockResolvedValue(flow({
      team: true, owner_user_id: null, owner_name: null,
      permissions: { ...gestor, personal: false, fixed_number: true },
    }));
    renderCanvas();
    const chave = await screen.findByRole('switch', { name: 'Da equipe' });
    expect(chave.getAttribute('aria-checked')).toBe('true');
    expect((chave as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Esta automação manda por um número específico. Pra virar pessoal, troque o número nos blocos.')).toBeTruthy();
    fireEvent.click(chave);
    expect(screen.queryByText('Tirar da equipe?')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('sem bloco de número específico a chave segue livre', async () => {
    get.mockResolvedValue(flow({
      team: true, owner_user_id: null, owner_name: null,
      permissions: { ...gestor, personal: false, fixed_number: false },
    }));
    renderCanvas();
    const chave = await screen.findByRole('switch', { name: 'Da equipe' });
    expect((chave as HTMLButtonElement).disabled).toBe(false);
    expect(within(chave.closest('div')!.parentElement!).queryByText(/número específico/)).toBeNull();
  });
});
