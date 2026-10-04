import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 4 (04/10/2026), seção A: o gatilho virou o bloco Início
// dentro do canvas, os blocos ficam num painel que abre e fecha, "Simular" fica
// ao lado de "Blocos", e o bloco abre num painel à direita.

const get = vi.hoisted(() => vi.fn());
const testRun = vi.hoisted(() => vi.fn());
const variablesList = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { get, testRun, update: vi.fn(), saveFlow: vi.fn(), toggle: vi.fn(), movePositions: vi.fn() },
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
vi.mock('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors')>();
  const resources = {
    labels: [{ id: 'l1', title: 'follow-up' }], sequences: [], followupFlows: [], users: [], pipelines: [],
    stagesByPipeline: {}, quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], evolutionInstances: [],
    reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
  };
  return { ...original, useAutomationResources: () => resources };
});

import FlowAutomationCanvas from './FlowAutomationCanvas';

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

describe('painel Blocos', () => {
  it('abre e fecha pelo botão e lembra como ficou', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    // Padrão: aberto.
    expect(screen.getByTestId('painel-blocos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Blocos/, pressed: true }));
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
    expect(window.localStorage.getItem('lmflow:construtor:blocos-aberto')).toBe('0');
  });

  it('clicar num bloco põe no canvas e abre o painel dele', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    const blocos = await screen.findByTestId('painel-blocos');
    fireEvent.click(within(blocos).getByRole('button', { name: /Esperar/ }));
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByRole('heading', { name: 'Esperar' })).toBeTruthy();
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
  });
});

describe('painel do bloco', () => {
  it('clicar no cartão abre o painel; Cancelar com alteração pergunta antes de descartar', async () => {
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mandar WhatsApp'));
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
    fireEvent.click(screen.getByLabelText('Editar Mandar WhatsApp'));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.change(within(painel).getByLabelText('Mensagem'), { target: { value: 'Olá de novo' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
    expect(screen.getByText('Olá de novo')).toBeTruthy();
  });

  it('mostra as variáveis da imobiliária junto com as prontas', async () => {
    variablesList.mockResolvedValue({
      builtin: [],
      custom: [{ id: 'v1', token: 'empreendimento', placeholder: '{{empreendimento}}', label: 'Empreendimento', active: true, value_source: 'literal:x', created_at: '', updated_at: '' }],
    });
    get.mockResolvedValue(flow());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    fireEvent.click(screen.getByLabelText('Editar Mandar WhatsApp'));
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByRole('button', { name: 'Corretor' })).toBeTruthy();
    expect(await within(painel).findByRole('button', { name: 'Empreendimento' })).toBeTruthy();
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
    const cartao = screen.getByLabelText('Editar Mandar WhatsApp').closest('[data-highlighted]');
    expect(cartao?.getAttribute('data-highlighted')).toBe('true');
  });
});
