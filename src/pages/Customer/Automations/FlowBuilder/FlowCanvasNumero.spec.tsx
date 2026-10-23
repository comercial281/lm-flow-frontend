import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildSaveFlowPayload, normalizeLoadedNodes } from '@/lib/flowAutomationGraph';
import type { FlowAutomationNode } from '@/types/flowAutomations';

// Entrega 4: o fluxo da equipe fala com o lead por UM número, escolhido nas
// Configurações. Fluxo antigo (sem a regra salva) que ninguém mexeu nas
// Configurações salva igual a hoje: sem send_from e sem tocar as Mensagens.

const get = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const sendNumbers = vi.hoisted(() => vi.fn());
const personalCapabilities = vi.hoisted(() => vi.fn());
const resolverConflitos = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, update, saveFlow, personalCapabilities, resolveNumberConflicts: resolverConflitos, testRun: vi.fn(), toggle: vi.fn(), movePositions: vi.fn(),
  },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => resource === 'flow_automations' && action !== 'own',
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'g1' } }),
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

const gestor = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: true };
const mensagem = (config: Record<string, unknown> = {}, id = 'n1', next: string | null = null): FlowAutomationNode => ({
  id, kind: 'send_whatsapp', label: null, config: { text: 'Oi', ...config },
  next_node_id: next, next_yes_node_id: null, next_no_node_id: null, pos_x: 0, pos_y: 100, steps: [],
} as FlowAutomationNode);
const ia: FlowAutomationNode = {
  id: 'n2', kind: 'hand_to_ai', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: 300, pos_y: 100, steps: [],
} as FlowAutomationNode;
const flow = (patch: Record<string, unknown> = {}) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.created', conditions: [] },
  initial_node_id: 'n1', nodes: [mensagem({ send_from: 'owner', send_from_inbox_id: '' })],
  team: true, owner_user_id: null, owner_name: null,
  permissions: { ...gestor, personal: false },
  ...patch,
});
const numeros = [
  { inbox_id: 'i1', name: 'Loja', phone: '5511912341292', connection: 'connected', owner: null },
  { inbox_id: 'i2', name: 'Plantão', phone: '5511900000017', connection: 'connected', owner: null },
];

const renderCanvas = () =>
  render(
    <MemoryRouter initialEntries={['/automations/fa1']}>
      <Routes>
        <Route path="/automations/:id" element={<FlowAutomationCanvas />} />
      </Routes>
    </MemoryRouter>,
  );

const NUMBER_KEYS = ['send_from', 'send_from_inbox_id', 'number_conflict'];

async function clicarSalvarDoTopo() {
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
}

beforeEach(() => {
  get.mockReset();
  update.mockReset().mockImplementation(async () => flow());
  saveFlow.mockReset();
  sendNumbers.mockReset().mockResolvedValue({ number_owner_rule: false, numbers: numeros });
  personalCapabilities.mockReset().mockResolvedValue({ tem_numero: true, numero: '5511987654321', tem_ia: true });
});

describe('número do fluxo: salvar', () => {
  it('salvar as Configurações chama update com send_from, send_from_inbox_id e number_conflict', async () => {
    get.mockResolvedValue(flow());
    saveFlow.mockImplementation(async () => flow({ send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause' }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Por um número específico' }));
    fireEvent.change(await within(dialogo).findByLabelText('Número do fluxo'), { target: { value: 'i1' } });
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Pausar e esperar alguém escolher' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Alterações não salvas')).toBeTruthy();
    await clicarSalvarDoTopo();

    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause' });
    // O número fica espelhado em cada Mensagem (a proteção de volta de versão).
    const [, payload] = saveFlow.mock.calls[0];
    expect(payload.nodes[0].config).toMatchObject({ send_from: 'number', send_from_inbox_id: 'i1' });
  });

  it('fluxo antigo sem mexer nas Configurações salva sem send_from e sem tocar as Mensagens', async () => {
    // Mensagem antiga de verdade (sem as chaves de número) e outra com a
    // "Instância de envio (admin)": nada disso pode mudar no Salvar.
    const legada: FlowAutomationNode = { ...mensagem({}, 'n1', 'n3'), config: { text: 'Oi' } } as FlowAutomationNode;
    const comInstancia = mensagem({ sender_instance: 'inst-velha' }, 'n3', 'n2');
    const original = flow({ nodes: [legada, comInstancia, ia] });
    get.mockResolvedValue(original);
    saveFlow.mockImplementation(async () => original);
    renderCanvas();
    const nome = await screen.findByRole('textbox', { name: 'Nome do fluxo' });
    fireEvent.change(nome, { target: { value: 'Boas-vindas 2' } });
    // Abrir e salvar as Configurações sem mexer no número também não conta.
    fireEvent.click(screen.getByRole('button', { name: /Configurações/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));
    await clicarSalvarDoTopo();

    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('fa1', {
      name: 'Boas-vindas 2',
      trigger: { event: 'lead.created', conditions: [], alternatives: [] },
      reentry_window_hours: 24,
      once_per_lead: false,
      business_hours_only: false,
    });
    expect(Object.keys(update.mock.calls[0][1]).filter(k => NUMBER_KEYS.includes(k))).toEqual([]);
    expect(saveFlow).toHaveBeenCalledWith('fa1', buildSaveFlowPayload(normalizeLoadedNodes(original.nodes as FlowAutomationNode[]), 'n1'));
    const [, payload] = saveFlow.mock.calls[0];
    const configs = payload.nodes.map((n: { config: Record<string, unknown> }) => n.config);
    expect(configs[0]).toEqual({ text: 'Oi' });
    expect(configs[1]).toEqual({ text: 'Oi', sender_instance: 'inst-velha' });
  });

  it('abrir as Configurações e salvar sem mudar nada não deixa "Alterações não salvas"', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('depois de salvar, o Início mostra a regra salva e o fluxo não fica com alteração', async () => {
    get.mockResolvedValue(flow());
    saveFlow.mockImplementation(async () => flow({ send_from: 'owner', send_from_inbox_id: '', number_conflict: 'pause' }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Pelo número da conversa do lead' }));
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Pelo número do responsável pelo lead' }));
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Pausar e esperar alguém escolher' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await clicarSalvarDoTopo();
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(await screen.findByText('Fala pelo responsável pelo lead')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Alterações não salvas')).toBeNull());
  });

  it('lista de números que não carregou avisa e tenta de novo ao reabrir', async () => {
    get.mockResolvedValue(flow());
    sendNumbers.mockReset().mockRejectedValueOnce(new Error('rede')).mockResolvedValue({ number_owner_rule: false, numbers: numeros });
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    let dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Por um número específico' }));
    expect(await within(dialogo).findByText('Não consegui carregar os números agora. Salvar mantém a escolha que já estava.')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Configurações/ }));
    dialogo = await screen.findByRole('dialog');
    await waitFor(() => expect(sendNumbers).toHaveBeenCalledTimes(2));
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Por um número específico' }));
    expect(await within(dialogo).findByRole('option', { name: /^Loja/ })).toBeTruthy();
    expect(within(dialogo).queryByText(/Não consegui carregar os números/)).toBeNull();
  });

  it('com a regra do dono ligada, o seletor mostra de quem é o número', async () => {
    get.mockResolvedValue(flow());
    sendNumbers.mockReset().mockResolvedValue({
      number_owner_rule: true,
      numbers: [{ ...numeros[0], owner: { id: 'u1', name: 'Ana' } }],
    });
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Configurações/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Por um número específico' }));
    expect(await within(dialogo).findByRole('option', { name: /de Ana$/ })).toBeTruthy();
  });

  it('fluxo com a regra salva manda a regra de novo no Salvar, mesmo sem mexer', async () => {
    const salvo = flow({ send_from: '', send_from_inbox_id: '', number_conflict: 'pause', nodes: [mensagem({ send_from: '', send_from_inbox_id: '' })] });
    get.mockResolvedValue(salvo);
    saveFlow.mockImplementation(async () => salvo);
    renderCanvas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Nome do fluxo' }), { target: { value: 'Outro nome' } });
    await clicarSalvarDoTopo();
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ send_from: '', send_from_inbox_id: '', number_conflict: 'pause' });
  });
});

describe('número do fluxo: leads pausados', () => {
  it('a faixa mostra a contagem e Resolver chama resolveNumberConflicts', async () => {
    get.mockResolvedValue(flow({ paused_other_number_count: 3, send_from: 'number', send_from_inbox_id: 'i1' }));
    resolverConflitos.mockResolvedValue({ resumed: 3, stopped: 0, skipped: 0, failed: 0 });
    renderCanvas();
    expect(await screen.findByText('3 leads pausados: já conversam em outro número')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: /Mandar pelo número do fluxo/ }));
    await waitFor(() => expect(resolverConflitos).toHaveBeenCalledWith('fa1', { choice: 'flow', always: false }));
  });

  it('só leitura vê a contagem mas não o Resolver', async () => {
    get.mockResolvedValue(flow({ paused_other_number_count: 2, permissions: { ...gestor, can_edit: false, personal: false } }));
    renderCanvas();
    expect(await screen.findByText('2 leads pausados: já conversam em outro número')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resolver' })).toBeNull();
  });

  it('sem pausados não tem faixa', async () => {
    get.mockResolvedValue(flow({ paused_other_number_count: 0 }));
    renderCanvas();
    await screen.findByRole('textbox', { name: 'Nome do fluxo' });
    expect(screen.queryByTestId('faixa-pausados')).toBeNull();
  });
});

describe('número do fluxo: Início e Mensagem', () => {
  it('cartão do Início mostra "Fala pelo final 92"', async () => {
    get.mockResolvedValue(flow({ send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause' }));
    renderCanvas();
    const inicio = await screen.findByTestId('bloco-inicio');
    await waitFor(() => expect(within(inicio).getByText('Fala pelo final 92')).toBeTruthy());
  });

  it('cartão do Início: conversa e responsável', async () => {
    get.mockResolvedValue(flow({ send_from: 'owner', send_from_inbox_id: '', number_conflict: 'pause' }));
    const { unmount } = renderCanvas();
    expect(await screen.findByText('Fala pelo responsável pelo lead')).toBeTruthy();
    unmount();
    get.mockResolvedValue(flow({ send_from: '', send_from_inbox_id: '', number_conflict: 'pause' }));
    renderCanvas();
    expect(await screen.findByText('Fala pelo número da conversa')).toBeTruthy();
  });

  it('fluxo antigo sem regra salva não mostra a linha no Início', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByText(/^Fala pel/)).toBeNull();
  });

  it('Mensagem de fluxo com número mostra a linha e não o seletor de número', async () => {
    get.mockResolvedValue(flow({
      send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause',
      nodes: [mensagem({ send_from: 'number', send_from_inbox_id: 'i1' }, 'n1', 'n2'), ia],
    }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Mensagem'));
    expect(await screen.findByText('Sai pelo número do fluxo (final 92). Trocar nas Configurações.')).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
  });

  it('Passar para a IA de fluxo com número diz a IA do número do fluxo', async () => {
    get.mockResolvedValue(flow({
      send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause',
      nodes: [mensagem({ send_from: 'number', send_from_inbox_id: 'i1' }, 'n1', 'n2'), ia],
    }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Passar para a IA'));
    expect(await screen.findByText('Quem atende: a IA do número do fluxo (final 92).')).toBeTruthy();
  });

  it('Passar para a IA de fluxo pelo responsável diz a IA do número do responsável', async () => {
    get.mockResolvedValue(flow({
      send_from: 'owner', send_from_inbox_id: '', number_conflict: 'pause',
      nodes: [mensagem({ send_from: 'owner', send_from_inbox_id: '' }, 'n1', 'n2'), ia],
    }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Passar para a IA'));
    expect(await screen.findByText('Quem atende: a IA do número do responsável pelo lead.')).toBeTruthy();
  });

  it('Mensagem no modo conversa diz o número da conversa do lead', async () => {
    get.mockResolvedValue(flow({ send_from: '', send_from_inbox_id: '', number_conflict: 'pause', nodes: [mensagem({ send_from: '', send_from_inbox_id: '' })] }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Mensagem'));
    expect(await screen.findByText('Sai pelo número da conversa do lead. Trocar nas Configurações.')).toBeTruthy();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
  });

  it('fluxo antigo com números diferentes avisa na Mensagem e nas Configurações', async () => {
    get.mockResolvedValue(flow({
      nodes: [mensagem({ send_from: 'owner', send_from_inbox_id: '' }, 'n1', 'n3'), mensagem({ send_from: 'number', send_from_inbox_id: 'i2' }, 'n3')],
    }));
    renderCanvas();
    const AVISO = 'Este fluxo fala por números diferentes. Escolha um nas Configurações.';
    fireEvent.click((await screen.findAllByLabelText('Editar Mensagem'))[0]);
    expect(await screen.findByText(AVISO)).toBeTruthy();
    expect(screen.getByText('Enviar pelo número')).toBeTruthy();
  });

  it('Mensagem de fluxo antigo continua com o seletor de número', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Mensagem'));
    expect(await screen.findByText('Enviar pelo número')).toBeTruthy();
    expect(screen.queryByText(/Trocar nas Configurações/)).toBeNull();
  });
});

describe('número do fluxo: automação pessoal', () => {
  it('automação pessoal não mostra o grupo nem a linha', async () => {
    get.mockResolvedValue(flow({
      team: false, owner_user_id: 'g1', owner_name: 'Gestor', permissions: { ...gestor, personal: true },
      send_from: 'number', send_from_inbox_id: 'i1', number_conflict: 'pause',
    }));
    saveFlow.mockImplementation(async () => flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByText(/^Fala pel/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Configurações/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('group', { name: 'Por qual número este fluxo fala com o lead' })).toBeNull();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do fluxo' }), { target: { value: 'Minha' } });
    await clicarSalvarDoTopo();
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(Object.keys(update.mock.calls[0][1]).filter(k => NUMBER_KEYS.includes(k))).toEqual([]);
  });
});
