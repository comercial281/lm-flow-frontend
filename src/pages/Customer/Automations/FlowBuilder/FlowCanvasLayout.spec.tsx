import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 4 (04/10/2026), seção A: o gatilho virou o bloco Início
// dentro do canvas e "Simular" fica ao lado de "Blocos". Redesenho de
// 16/10/2026: Blocos abre uma lista embaixo do botão e o bloco (e o Início)
// abre numa janela no meio da tela.

const get = vi.hoisted(() => vi.fn());
const testRun = vi.hoisted(() => vi.fn());
const variablesList = vi.hoisted(() => vi.fn());
const toggle = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const uploadMedia = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { get, testRun, update: vi.fn(), saveFlow, toggle, movePositions: vi.fn(), uploadMedia },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: variablesList },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/features/flowAutomations/editores/LeadAutomationsEditors')>();
  const resources = {
    labels: [{ id: 'l1', title: 'follow-up' }], sequences: [], followupFlows: [], users: [], pipelines: [],
    stagesByPipeline: {}, quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
    reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
  };
  return { ...original, useAutomationResources: () => resources };
});

import FlowAutomationCanvas from './FlowAutomationCanvas';
import { simularCelular } from '@/test/telaDeCelular';
import FlowCanvasCelular, { AVISO_NAO_SALVO_NO_CELULAR } from './FlowCanvasCelular';
import { act } from '@testing-library/react';

beforeAll(() => {
  // O React Flow mede os blocos; o jsdom não tem estas duas. Sem medida, os
  // blocos ficam no DOM mas invisíveis: por isso as buscas são pelo nome (aria-label).
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

const flow = (patch: Record<string, unknown> = {}) => ({
  id: 'fa1', name: 'Boas-vindas', folder_id: null, is_enabled: false, version: 1,
  reentry_window_hours: 24, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
  trigger: {
    event: 'lead.tag_added',
    conditions: [{ field: 'label', operator: 'eq', value: 'follow-up' }],
    alternatives: [{ event: 'lead.visit_completed', conditions: [] }],
  },
  initial_node_id: 'n1',
  nodes: [{
    id: 'n1', kind: 'send_whatsapp', label: null, config: { text: 'Oi' },
    next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  }],
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
  testRun.mockReset();
  saveFlow.mockReset();
  uploadMedia.mockReset();
  variablesList.mockReset();
  variablesList.mockResolvedValue({ builtin: [], custom: [] });
  try {
    window.localStorage.clear();
  } catch {
    // sem armazenamento no ambiente
  }
});

describe('bloco Início', () => {
  it('mostra o gatilho numa linha, com o "ou", e a barra do topo saiu', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    const inicio = await screen.findByTestId('bloco-inicio');
    expect(inicio.textContent).toContain('Início');
    expect(inicio.textContent).toContain('Quando:');
    expect(inicio.textContent).toMatch(/Etiqueta: follow-up/);
    expect(inicio.textContent).toMatch(/· ou /);
    // O botão de gatilho do topo e o "Testar" saíram; "Simular" está no canvas.
    expect(screen.queryByRole('button', { name: /^Testar$/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Simular/ })).toBeTruthy();
  });

  it('clicar no Início abre o painel do gatilho, com "Ou quando…"', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    fireEvent.click(await screen.findByLabelText(/Início\. Quando:/));
    const painel = await screen.findByTestId('painel-do-inicio');
    expect(within(painel).getByRole('heading', { name: 'Início' })).toBeTruthy();
    expect(within(painel).getByRole('button', { name: /^Ou quando…$/ })).toBeTruthy();
  });

  it('Simular roda o teste do fluxo', async () => {
    get.mockResolvedValue(flow());
    testRun.mockResolvedValue({ instance_id: 'i1', state: 'completed', stop_reason: null, steps: [] });
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: /Simular/ }));
    await waitFor(() => expect(testRun).toHaveBeenCalledWith('fa1', {}));
    expect(await screen.findByText('Resultado da simulação')).toBeTruthy();
  });
});

describe('lista de blocos', () => {
  it('Blocos começa fechado, abre embaixo do botão e fecha ao escolher', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
    const botao = screen.getByRole('button', { name: /Blocos/ });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    const lista = await screen.findByTestId('painel-blocos');
    expect(screen.getByRole('button', { name: /Blocos/ }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(lista).getByRole('button', { name: /Esperar/ }));
    await waitFor(() => expect(screen.queryByTestId('painel-blocos')).toBeNull());
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByRole('heading', { name: 'Esperar' })).toBeTruthy();
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
  });

  it('não lembra se ficou aberto: reabrir a tela começa fechado', async () => {
    window.localStorage.setItem('lmflow:construtor:blocos-aberto', '1');
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
  });

  it('Esc fecha a lista', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByRole('button', { name: /Blocos/ }));
    await screen.findByTestId('painel-blocos');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('painel-blocos')).toBeNull());
  });

  it('"+ saída" do cartão abre a lista e liga o bloco escolhido nessa saída', async () => {
    saveFlow.mockResolvedValue(undefined);
    get.mockResolvedValue(flow({
      nodes: [{
        id: 'n1', kind: 'wait_for_reply', label: null, config: {},
        next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
      }],
    }));
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
    // No jsdom o React Flow esconde os cartões: o botão se acha pelo texto.
    fireEvent.click(screen.getByText(/\+ Respondeu/));
    const lista = await screen.findByTestId('painel-blocos');
    // A saída aparece dentro da própria lista (um aviso solto no canvas ficaria embaixo dela).
    expect(within(lista).getByTestId('saida-pendente').textContent).toContain('Ligando na saída "Respondeu"');
    fireEvent.click(within(lista).getByRole('button', { name: /Esperar/ }));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    const payload = saveFlow.mock.calls[0][1] as { nodes: Array<{ id: string; kind: string; next_yes_node_id: string | null; next_no_node_id: string | null }> };
    const novo = payload.nodes.find(n => n.kind === 'wait');
    const espera = payload.nodes.find(n => n.id === 'n1');
    expect(novo).toBeTruthy();
    expect(espera?.next_yes_node_id).toBe(novo?.id);
    expect(espera?.next_no_node_id).toBeNull();
  });
});

describe('lista de blocos pelo "+ saída"', () => {
  const comEspera = () => flow({
    nodes: [{
      id: 'n1', kind: 'wait_for_reply', label: null, config: {},
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
    }],
  });

  it('fechar a lista com Esc esquece a saída: reabrir por Blocos não liga mais nela', async () => {
    get.mockResolvedValue(comEspera());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByText(/\+ Respondeu/));
    await screen.findByTestId('saida-pendente');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('painel-blocos')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Blocos/ }));
    await screen.findByTestId('painel-blocos');
    expect(screen.queryByTestId('saida-pendente')).toBeNull();
  });

  it('"cancelar" dentro da lista esquece a saída e a lista continua aberta', async () => {
    get.mockResolvedValue(comEspera());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByText(/\+ Respondeu/));
    const linha = await screen.findByTestId('saida-pendente');
    fireEvent.click(within(linha).getByRole('button', { name: 'cancelar' }));
    await waitFor(() => expect(screen.queryByTestId('saida-pendente')).toBeNull());
    expect(screen.getByTestId('painel-blocos')).toBeTruthy();
  });
});

describe('onde o bloco novo entra (20/10/2026)', () => {
  type Saved = { id: string; kind: string; next_node_id: string | null; next_yes_node_id: string | null; next_no_node_id: string | null };
  const escolherESalvar = async (lista: HTMLElement) => {
    fireEvent.click(within(lista).getByRole('button', { name: /Esperar/ }));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    return saveFlow.mock.calls[0][1] as { initial_node_id: string | null; nodes: Saved[] };
  };

  it('pelo botão Blocos, com o fluxo já montado, o bloco entra solto', async () => {
    saveFlow.mockResolvedValue(undefined);
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByRole('button', { name: /Blocos/ }));
    const payload = await escolherESalvar(await screen.findByTestId('painel-blocos'));
    const novo = payload.nodes.find(n => n.kind === 'wait');
    expect(novo).toBeTruthy();
    expect(payload.nodes.find(n => n.id === 'n1')?.next_node_id).toBeNull();
    expect(payload.initial_node_id).toBe('n1');
  });

  it('pelo botão Blocos, sem bloco nenhum, o primeiro entra logo depois do Início', async () => {
    saveFlow.mockResolvedValue(undefined);
    get.mockResolvedValue(flow({ initial_node_id: null, nodes: [] }));
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByRole('button', { name: /Blocos/ }));
    const payload = await escolherESalvar(await screen.findByTestId('painel-blocos'));
    const novo = payload.nodes.find(n => n.kind === 'wait');
    expect(payload.initial_node_id).toBe(novo?.id);
  });

  it('"+ Não respondeu" já ligado encaixa o bloco no meio', async () => {
    saveFlow.mockResolvedValue(undefined);
    get.mockResolvedValue(flow({
      nodes: [
        { id: 'n1', kind: 'wait_for_reply', label: null, config: {}, next_node_id: null, next_yes_node_id: null, next_no_node_id: 'n2', pos_x: null, pos_y: null, steps: [] },
        { id: 'n2', kind: 'disable_ai', label: null, config: {}, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
      ],
    }));
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByText(/\+ Não respondeu/));
    const payload = await escolherESalvar(await screen.findByTestId('painel-blocos'));
    const novo = payload.nodes.find(n => n.kind === 'wait');
    expect(payload.nodes.find(n => n.id === 'n1')?.next_no_node_id).toBe(novo?.id);
    expect(novo?.next_node_id).toBe('n2');
  });

  it('bloco simples já ligado também tem "+"', async () => {
    get.mockResolvedValue(flow({
      nodes: [
        { id: 'n1', kind: 'send_whatsapp', label: null, config: { text: 'Oi' }, next_node_id: 'n2', next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
        { id: 'n2', kind: 'disable_ai', label: null, config: {}, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
      ],
    }));
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.getAllByText(/\+ Continuar/)).toHaveLength(2);
  });
});

describe('duplicar bloco', () => {
  it('a cópia da Mensagem ganha config própria, com id novo em cada item', async () => {
    saveFlow.mockResolvedValue(undefined);
    get.mockResolvedValue(flow({
      nodes: [{
        id: 'n1', kind: 'send_whatsapp', label: null,
        config: { text: '', items: [{ id: 'a', kind: 'text', text_content: 'Oi' }, { id: 'b', kind: 'text', text_content: 'Tudo bem?' }] },
        next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
      }],
    }));
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText(/^Duplicar /));
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    const payload = saveFlow.mock.calls[0][1] as { nodes: Array<{ id: string; config: { items: Array<{ id: string; text_content: string }> } }> };
    expect(payload.nodes).toHaveLength(2);
    const [original, copia] = [payload.nodes.find(n => n.id === 'n1')!, payload.nodes.find(n => n.id !== 'n1')!];
    expect(original.config.items.map(i => i.id)).toEqual(['a', 'b']);
    expect(copia.config.items.map(i => i.text_content)).toEqual(['Oi', 'Tudo bem?']);
    expect(copia.config.items.map(i => i.id)).not.toContain('a');
    expect(copia.config.items.map(i => i.id)).not.toContain('b');
    expect(copia.config).not.toBe(original.config);
  });
});

describe('painel do bloco', () => {
  it('clicar no cartão abre o painel; Cancelar com alteração pergunta antes de descartar', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mensagem'));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.change(within(painel).getByLabelText('Mensagem'), { target: { value: 'Oi, tudo bem?' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Descartar o que você mudou?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByTestId('painel-do-bloco')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('painel-do-bloco')).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
  });

  it('Salvar aplica no cartão e fecha o painel', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mensagem'));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.change(within(painel).getByLabelText('Mensagem'), { target: { value: 'Olá de novo' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
    expect(screen.getByText('Olá de novo')).toBeTruthy();
  });

  // PR 8 (16/10/2026): o bloco Mensagem é uma sequência, no editor do Disparo em massa.
  it('o bloco Mensagem abre a sequência; adicionar Imagem e salvar grava items no saveFlow', async () => {
    saveFlow.mockResolvedValue(undefined);
    uploadMedia.mockResolvedValue('https://cdn/foto.jpg');
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mensagem'));
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByRole('heading', { name: 'Mensagem' })).toBeTruthy();
    expect(within(painel).getByText('Itens em sequência (1)')).toBeTruthy();
    expect(within(painel).getByRole('button', { name: 'Book do imóvel' })).toBeTruthy();
    fireEvent.click(within(painel).getByRole('button', { name: 'Imagem' }));
    expect(within(painel).getByText('Itens em sequência (2)')).toBeTruthy();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(painel.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledWith(file));
    await waitFor(() => expect(within(painel).getByText('foto.jpg')).toBeTruthy());
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
    expect(screen.getByText('2 mensagens')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/ }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    const payload = saveFlow.mock.calls[0][1] as { nodes: unknown[] };
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        config: expect.objectContaining({
          items: [
            expect.objectContaining({ kind: 'text' }),
            expect.objectContaining({ kind: 'image', media_url: 'https://cdn/foto.jpg' }),
          ],
        }),
      }),
    ]);
  });

  it('mostra as variáveis da imobiliária junto com as prontas', async () => {
    variablesList.mockResolvedValue({
      builtin: [],
      custom: [{ id: 'v1', token: 'empreendimento', placeholder: '{{empreendimento}}', label: 'Empreendimento', active: true, value_source: 'literal:x', created_at: '', updated_at: '' }],
    });
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mensagem'));
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByRole('button', { name: /^Corretor/ })).toBeTruthy();
    // A da imobiliária fica recolhida em "Mais variáveis" > "Da imobiliária".
    expect(within(painel).queryByRole('button', { name: /Empreendimento/ })).toBeNull();
    fireEvent.click(within(painel).getByRole('button', { name: 'Mais variáveis' }));
    expect(await within(painel).findByRole('button', { name: /Empreendimento/ })).toBeTruthy();
  });
});

describe('extensões pro guia', () => {
  it('banner aparece acima do canvas e o bloco destacado ganha a marca', async () => {
    get.mockResolvedValue(flow());
    render(
      <MemoryRouter initialEntries={['/automations/fa1']}>
        <Routes>
          <Route path="/automations/:id" element={<FlowAutomationCanvas banner={<p>Passo 1 de 2</p>} highlightedNodeId="n1" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Passo 1 de 2')).toBeTruthy();
    const cartao = screen.getByLabelText('Editar Mensagem').closest('[data-highlighted]');
    expect(cartao?.getAttribute('data-highlighted')).toBe('true');
  });
});

describe('celular (Raio-X do celular, 10/10/2026)', () => {
  let tela: ReturnType<typeof simularCelular> | null = null;
  beforeEach(() => toggle.mockReset());
  afterEach(() => {
    tela?.restaurar();
    tela = null;
  });

  const abrirNoCelular = () =>
    render(
      <MemoryRouter initialEntries={['/automations/fa1']}>
        <Routes>
          <Route path="/automations/:id" element={<FlowAutomationCanvas />} />
          <Route path="/automations/flow-builder" element={<p>lista de fluxos</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('mostra o nome, a chave e o aviso; sem desenho, Salvar, Blocos nem Simular', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow());
    abrirNoCelular();
    expect(await screen.findByRole('heading', { name: 'Boas-vindas' })).toBeTruthy();
    expect(screen.getByText('Pra editar este fluxo, abra no computador.')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Ligar o fluxo' })).toBeTruthy();
    expect(screen.queryByTestId('bloco-inicio')).toBeNull();
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Blocos/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Simular/ })).toBeNull();
  });

  it('a chave liga pelo mesmo caminho do canvas', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow());
    toggle.mockResolvedValue({ is_enabled: true });
    abrirNoCelular();
    const chave = await screen.findByRole('switch', { name: 'Ligar o fluxo' });
    fireEvent.click(chave);
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('fa1'));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Ligar o fluxo' }).getAttribute('aria-checked')).toBe('true'));
  });

  it('a chave recusa ligar fluxo com bloco incompleto, como no canvas', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow({
      nodes: [{
        id: 'n1', kind: 'send_whatsapp', label: null, config: { text: '' },
        next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
      }],
    }));
    abrirNoCelular();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ligar o fluxo' }));
    await new Promise(r => setTimeout(r, 0));
    expect(toggle).not.toHaveBeenCalled();
  });

  it('o voltar leva pra lista', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow());
    abrirNoCelular();
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('lista de fluxos')).toBeTruthy();
  });

  it('funil da equipe só pra ver: aviso sem a chave', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow({ kind: 'conversation', team: true, permissions: { can_edit: false, guided: false } }));
    abrirNoCelular();
    expect(await screen.findByText('Pra editar este funil, abra no computador.')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('abrir no computador e encolher pra celular não troca a tela (o painel aberto fica)', async () => {
    tela = simularCelular(false);
    get.mockResolvedValue(flow());
    abrirNoCelular();
    fireEvent.click(await screen.findByLabelText(/Início\. Quando:/));
    expect(await screen.findByTestId('painel-do-inicio')).toBeTruthy();
    act(() => tela!.mudar(true));
    expect(screen.getByTestId('painel-do-inicio')).toBeTruthy();
    expect(screen.getByTestId('bloco-inicio')).toBeTruthy();
    expect(screen.queryByText('Pra editar este fluxo, abra no computador.')).toBeNull();
  });

  it('abrir no celular e alargar a tela continua na tela do celular', async () => {
    tela = simularCelular();
    get.mockResolvedValue(flow());
    abrirNoCelular();
    expect(await screen.findByText('Pra editar este fluxo, abra no computador.')).toBeTruthy();
    act(() => tela!.mudar(false));
    expect(screen.getByText('Pra editar este fluxo, abra no computador.')).toBeTruthy();
    expect(screen.queryByTestId('bloco-inicio')).toBeNull();
  });

  it('com alteração não salva: sem a chave, com a linha de abrir no computador', () => {
    const aoMudarLigado = vi.fn();
    render(
      <MemoryRouter>
        <FlowCanvasCelular
          kind="automation" nome="Boas-vindas" ligado={false} soVer={false} naoSalvo
          aoMudarLigado={aoMudarLigado} aoVoltar={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status').textContent).toContain(AVISO_NAO_SALVO_NO_CELULAR);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('Pra editar este fluxo, abra no computador.')).toBeTruthy();
  });

  it('computador: o canvas continua igual', async () => {
    tela = simularCelular(false);
    get.mockResolvedValue(flow());
    abrirNoCelular();
    expect(await screen.findByTestId('bloco-inicio')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Simular/ })).toBeTruthy();
    expect(screen.queryByText('Pra editar este fluxo, abra no computador.')).toBeNull();
  });
});
