import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Follow-up com condições de retomada (04/11/2026): "+ Adicionar mensagem" e tirar mensagem
// passam pelo servidor, que religa as pontas e a etiqueta.

const get = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const addMessage = vi.hoisted(() => vi.fn());
const removeMessage = vi.hoisted(() => vi.fn());
const movePositions = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {
    get, personalCapabilities: vi.fn(), update, duplicate: vi.fn(), testRun: vi.fn(), saveFlow, toggle: vi.fn(), movePositions, addMessage, removeMessage, uploadMedia: vi.fn(),
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
// Espia as props que o canvas passa pro React Flow (as linhas e os blocos), sem trocar o componente.
const reactFlowProps = vi.hoisted(() => ({ last: null as null | { edges: Array<{ id: string; deletable?: boolean }>; nodes: Array<{ id: string; deletable?: boolean }> } }));
vi.mock('@xyflow/react', async importOriginal => {
  const original = await importOriginal<typeof import('@xyflow/react')>();
  const Original = original.ReactFlow;
  return {
    ...original,
    ReactFlow: (props: React.ComponentProps<typeof Original>) => {
      reactFlowProps.last = props as never;
      return <Original {...props} />;
    },
  };
});
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
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
const msg = bloco({ id: 'm1', kind: 'send_whatsapp', label: 'Primeira mensagem', config: { text: 'Oi', items: [{ id: 'i1', kind: 'text', text_content: 'Oi' }] }, next_node_id: 'w1' });
const espera = bloco({ id: 'w1', kind: 'wait', label: 'Esperar 1 dia', config: { amount: 1, unit: 'days' }, pos_y: 150, next_node_id: 'n1' });
const retomada = bloco({ id: 'n1', kind: 'condition', label: 'Continuar da mensagem 2', config: { criterion: 'has_label', label: 'polo-msg-1' }, pos_y: 300, next_yes_node_id: 'm1' });

const permissoes = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: false, personal: false };
const fluxo = (over: Record<string, unknown> = {}) => ({
  id: 'f1', name: 'Follow-up Polo', kind: 'followup', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 0, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: { event: 'lead.stage_changed', conditions: [] },
  initial_node_id: 'm1', nodes: [msg, espera, retomada],
  team: true, owner_user_id: 'u1', owner_name: 'Gestor', live_count: 0, my_default: false, account_default: false,
  permissions: permissoes,
  followup_messages: { supported: true, count: 1, limit: 25, last_node_id: 'w1', locked_ids: ['m1', 'n1'] },
  ...over,
});

const renderCanvas = () =>
  render(
    <MemoryRouter initialEntries={['/automations/follow-ups/f1']}>
      <Routes>
        <Route path="/automations/follow-ups/:id" element={<FlowAutomationCanvas />} />
      </Routes>
    </MemoryRouter>,
  );

// Consulta por texto: `getByRole` varre o desenho inteiro do React Flow e estoura o tempo do `findBy`.
const BOTAO = '+ Adicionar mensagem';
const nova = bloco({ id: 'm2', kind: 'send_whatsapp', label: 'Segunda mensagem', config: { text: 'Voltei' }, pos_y: 450 });
const respostaDoServidor = () => fluxo({
  nodes: [msg, espera, nova],
  followup_messages: { supported: true, count: 2, limit: 25, last_node_id: 'm2', locked_ids: ['m1', 'm2'] },
});

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(fluxo());
  saveFlow.mockReset();
  saveFlow.mockResolvedValue({});
  update.mockReset();
  update.mockResolvedValue({});
  movePositions.mockReset();
  movePositions.mockResolvedValue(undefined);
  addMessage.mockReset();
  removeMessage.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
});

const abrirJanela = async () => {
  fireEvent.click(await screen.findByText(BOTAO));
  return screen.findByRole('dialog');
};

describe('botão "+ Adicionar mensagem"', () => {
  it('gestor: aparece só embaixo do cartão de last_node_id', async () => {
    renderCanvas();
    await screen.findByText('Primeira mensagem');
    const botoes = await screen.findAllByText(BOTAO);
    expect(botoes).toHaveLength(1);
    expect(botoes[0].closest('.fluxo-bloco')?.textContent).toContain('Esperar 1 dia');
  });

  it('no limite (count 25) não aparece', async () => {
    get.mockResolvedValue(fluxo({ followup_messages: { supported: true, count: 25, limit: 25, last_node_id: 'w1', locked_ids: ['m1', 'n1'] } }));
    renderCanvas();
    await screen.findByText('Primeira mensagem');
    expect(screen.queryByText(BOTAO)).toBeNull();
  });

  it('sem supported não aparece', async () => {
    get.mockResolvedValue(fluxo({ followup_messages: { supported: false, count: 0, limit: 25, last_node_id: null, locked_ids: [] } }));
    renderCanvas();
    await screen.findByText('Primeira mensagem');
    expect(screen.queryByText(BOTAO)).toBeNull();
  });

  it('corretor no follow-up dele (guiado): aparece', async () => {
    get.mockResolvedValue(fluxo({ permissions: { ...permissoes, guided: true, can_mark_team: false } }));
    renderCanvas();
    expect(await screen.findByText(BOTAO)).toBeTruthy();
  });

  it('só ver (can_edit false): não aparece', async () => {
    get.mockResolvedValue(fluxo({ permissions: { ...permissoes, can_edit: false } }));
    renderCanvas();
    await screen.findByText('Primeira mensagem');
    expect(screen.queryByText(BOTAO)).toBeNull();
  });

  it('item "Adicionar mensagem" na lista de Blocos abre a janela; sem arraste', async () => {
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Blocos/ }));
    const item = await screen.findByRole('button', { name: /^Adicionar mensagem/ });
    expect(item.getAttribute('draggable')).not.toBe('true');
    fireEvent.click(item);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Mensagem')).toBeTruthy();
  });

  it('sem a condição (limite), a lista de Blocos não traz o item', async () => {
    get.mockResolvedValue(fluxo({ followup_messages: { supported: true, count: 25, limit: 25, last_node_id: 'w1', locked_ids: ['m1', 'n1'] } }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Blocos/ }));
    await screen.findByText('Esperar');
    expect(screen.queryByRole('button', { name: /^Adicionar mensagem/ })).toBeNull();
  });
});

describe('janela da nova mensagem', () => {
  it('não tem escolha de número e diz por onde sai', async () => {
    renderCanvas();
    const janela = await abrirJanela();
    expect(within(janela).getByText('Sai pelo mesmo número da mensagem anterior.')).toBeTruthy();
    expect(within(janela).queryByText(/Enviar pelo número/i)).toBeNull();
  });

  it('corretor: "Sai pelo WhatsApp do responsável pelo lead."', async () => {
    get.mockResolvedValue(fluxo({ permissions: { ...permissoes, guided: true, can_mark_team: false } }));
    renderCanvas();
    const janela = await abrirJanela();
    expect(within(janela).getByText('Sai pelo WhatsApp do responsável pelo lead.')).toBeTruthy();
  });

  it('sem conteúdo o Salvar fica desligado; com texto salva e o desenho mostra a resposta', async () => {
    addMessage.mockResolvedValue(respostaDoServidor());
    renderCanvas();
    const janela = await abrirJanela();
    const salvar = within(janela).getByRole('button', { name: 'Salvar' });
    expect((salvar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(janela).getByLabelText('Mensagem'), { target: { value: 'Voltei' } });
    expect((salvar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(salvar);
    await waitFor(() => expect(addMessage).toHaveBeenCalledWith('f1', expect.objectContaining({
      items: [expect.objectContaining({ kind: 'text', text_content: 'Voltei' })],
    })));
    expect(await screen.findByText('Segunda mensagem')).toBeTruthy();
    expect(saveFlow).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Mensagem adicionada'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('edição pendente com saveFlow rejeitado: não adiciona, janela e texto ficam, edição pendente continua', async () => {
    saveFlow.mockRejectedValue(new Error('falhou'));
    renderCanvas();
    // edição pendente: renomear o nome do fluxo
    const nome = await screen.findByLabelText('Nome do fluxo');
    fireEvent.change(nome, { target: { value: 'Polo editado' } });
    expect(await screen.findByText('Alterações não salvas')).toBeTruthy();
    const janela = await abrirJanela();
    fireEvent.change(within(janela).getByLabelText('Mensagem'), { target: { value: 'Voltei' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(addMessage).not.toHaveBeenCalled();
    expect((within(screen.getByRole('dialog')).getByLabelText('Mensagem') as HTMLTextAreaElement).value).toBe('Voltei');
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
    expect((screen.getByLabelText('Nome do fluxo') as HTMLInputElement).value).toBe('Polo editado');
  });

  it('erro do servidor: toast com a frase e a janela continua aberta', async () => {
    addMessage.mockRejectedValue({ response: { data: { errors: ['Este follow-up já tem 25 mensagens, o limite.'] } } });
    renderCanvas();
    const janela = await abrirJanela();
    fireEvent.change(within(janela).getByLabelText('Mensagem'), { target: { value: 'Voltei' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Este follow-up já tem 25 mensagens, o limite.'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('tirar mensagem pelo servidor', () => {
  it('gestor: pede confirmação, chama removeMessage e não chama saveFlow (mesmo estando em locked_ids)', async () => {
    removeMessage.mockResolvedValue(fluxo({ nodes: [espera, retomada], initial_node_id: 'w1', followup_messages: { supported: true, count: 0, limit: 25, last_node_id: 'w1', locked_ids: ['n1'] } }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Excluir Primeira mensagem'));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar' }));
    await waitFor(() => expect(removeMessage).toHaveBeenCalledWith('f1', 'm1'));
    expect(saveFlow).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Primeira mensagem')).toBeNull());
  });

  it('cancelar não chama nada', async () => {
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Excluir Primeira mensagem'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await new Promise(r => setTimeout(r, 30));
    expect(removeMessage).not.toHaveBeenCalled();
    expect(saveFlow).not.toHaveBeenCalled();
  });

  it('corretor também pode excluir a mensagem (locked_ids)', async () => {
    get.mockResolvedValue(fluxo({ permissions: { ...permissoes, guided: true, can_mark_team: false } }));
    renderCanvas();
    expect(await screen.findByLabelText('Excluir Primeira mensagem')).toBeTruthy();
  });

  it('locked_ids segue travando Excluir na espera que ele cobre; a tecla Delete segue off na mensagem', async () => {
    get.mockResolvedValue(fluxo({ followup_messages: { supported: true, count: 1, limit: 25, last_node_id: 'w1', locked_ids: ['m1', 'w1', 'n1'] } }));
    renderCanvas();
    await screen.findByText('Primeira mensagem');
    expect(screen.queryByLabelText('Excluir Esperar 1 dia')).toBeNull();
    expect(reactFlowProps.last!.nodes.find(n => n.id === 'm1')!.deletable).toBe(false);
  });

  it('em automação, excluir bloco não chama removeMessage', async () => {
    get.mockResolvedValue(fluxo({ kind: 'automation' }));
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Excluir Primeira mensagem'));
    await new Promise(r => setTimeout(r, 30));
    expect(removeMessage).not.toHaveBeenCalled();
    expect(screen.queryByText(BOTAO)).toBeNull();
  });
});
