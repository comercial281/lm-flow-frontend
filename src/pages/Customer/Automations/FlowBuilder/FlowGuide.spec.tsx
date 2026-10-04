import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 4 (04/10/2026), parte B: construção guiada (faixa do
// passo, bloco destacado, checklist, avanço depois do Salvar) e o canvas no
// modo guiado (o corretor no funil de conversa) e só pra ver (funil da equipe).

const get = vi.hoisted(() => vi.fn());
const saveFlow = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const toggle = vi.hoisted(() => vi.fn());
const duplicate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { get, saveFlow, update, toggle, duplicate, testRun: vi.fn(), movePositions: vi.fn(), uploadMedia: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
  messageFunnelsService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors', async importOriginal => {
  const original = await importOriginal<typeof import('@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors')>();
  const resources = {
    labels: [], sequences: [], followupFlows: [], users: [], pipelines: [],
    stagesByPipeline: {}, quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], evolutionInstances: [],
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

const guide = (step: number, title: string, done = false, required = ['text']) => ({
  step, total: 2, title, hint: `Dica do passo ${step}`, required, done,
});

const node = (id: string, patch: Record<string, unknown> = {}) => ({
  id, kind: 'send_whatsapp', label: null, config: { text: 'Oi {{nome}}' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [], ...patch,
});

/** Funil "Apresentação do imóvel" encurtado: abertura → espera 5s → foto. */
const funnel = (opts: { doneSteps?: number[]; permissions?: Record<string, boolean>; team?: boolean } = {}) => {
  const done = opts.doneSteps ?? [];
  return {
    id: 'fa1', name: 'Apresentação do imóvel', kind: 'conversation', folder_id: null, is_enabled: false, version: 1,
    reentry_window_hours: 0, max_depth: 50, archived_at: null, created_at: '', updated_at: '',
    trigger: { event: 'conversation.manual', conditions: [] },
    team: opts.team ?? false,
    permissions: { can_edit: true, guided: true, can_mark_team: false, can_create_blank: false, ...opts.permissions },
    guide_done: done.length === 2,
    initial_node_id: 'm1',
    nodes: [
      node('m1', { label: 'Abertura', next_node_id: 'w1', guide: guide(1, 'Escreva a mensagem de abertura', done.includes(1)) }),
      node('w1', { kind: 'wait', label: 'Espera', config: { mode: 'interval', minutes: 0, seconds: 5 }, next_node_id: 'm2' }),
      node('m2', {
        label: 'Foto do imóvel',
        config: { text: '', media_kind: 'image', media_url: done.includes(2) ? 'https://x/foto.jpg' : '' },
        guide: guide(2, 'Escolha a foto do imóvel', done.includes(2), ['media_url']),
      }),
    ],
  };
};

const renderCanvas = () =>
  render(
    <MemoryRouter initialEntries={['/automations/message-funnels/fa1']}>
      <Routes>
        <Route path="/automations/message-funnels/:id" element={<FlowAutomationCanvas />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  saveFlow.mockReset();
  update.mockReset();
  toggle.mockReset();
  duplicate.mockReset();
  Object.values(toast).forEach(fn => fn.mockReset());
  try {
    window.localStorage.clear();
  } catch {
    // sem armazenamento no ambiente
  }
});

describe('construção guiada', () => {
  it('a faixa mostra o passo atual, o bloco dele pisca e o checklist marca feito/atual/falta', async () => {
    get.mockResolvedValue(funnel({ doneSteps: [1] }));
    renderCanvas();
    const faixa = await screen.findByTestId('faixa-do-guia');
    expect(faixa.textContent).toContain('Passo 2 de 2:');
    expect(faixa.textContent).toContain('clique no bloco destacado e escolha a foto do imóvel.');
    const foto = screen.getByLabelText('Editar Foto do imóvel').closest('[data-highlighted]');
    expect(foto?.getAttribute('data-highlighted')).toBe('true');
    expect(foto?.getAttribute('data-guide')).toBe('current');
    const abertura = screen.getByLabelText('Editar Abertura').closest('[data-guide]');
    expect(abertura?.getAttribute('data-guide')).toBe('done');
    const checklist = screen.getByTestId('checklist-do-guia');
    expect(checklist.textContent).toContain('1 de 2 feitos');
    const itens = within(checklist).getAllByRole('button').filter(b => b.dataset.estado);
    expect(itens.map(b => b.dataset.estado)).toEqual(['feito', 'atual']);
  });

  it('o painel do bloco mostra a dica; Salvar grava na hora com guide_done e o guia avança', async () => {
    get.mockResolvedValue(funnel());
    // Depois de salvar, o servidor devolve o passo 1 feito.
    saveFlow.mockResolvedValue(funnel({ doneSteps: [1] }));
    renderCanvas();
    expect((await screen.findByTestId('faixa-do-guia')).textContent).toContain('Passo 1 de 2:');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o bloco' }));
    const painel = await screen.findByTestId('painel-do-bloco');
    expect(within(painel).getByTestId('dica-do-passo').textContent).toContain('Passo 1 de 2 — Escreva a mensagem de abertura');
    expect(within(painel).getByTestId('dica-do-passo').textContent).toContain('Dica: Dica do passo 1');
    // Modo guiado: sem apelido do bloco.
    expect(within(painel).queryByLabelText('Apelido do bloco (opcional)')).toBeNull();
    fireEvent.change(within(painel).getByLabelText('Mensagem'), { target: { value: 'Oi {{nome}}, separei um imóvel' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(saveFlow).toHaveBeenCalledTimes(1));
    const [, payload] = saveFlow.mock.calls[0];
    const m1 = payload.nodes.find((n: { id: string }) => n.id === 'm1');
    expect(m1.guide_done).toBe(true);
    expect(m1.config.text).toBe('Oi {{nome}}, separei um imóvel');
    expect(m1.guide).toBeUndefined();
    // Os outros blocos não confirmam passo.
    expect(payload.nodes.find((n: { id: string }) => n.id === 'm2').guide_done).toBeUndefined();
    // Modo guiado: o cabeçalho manda só o nome, e só se mudou.
    expect(update).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.getByTestId('faixa-do-guia').textContent).toContain('Passo 2 de 2:'));
    await waitFor(() => expect(screen.queryByTestId('painel-do-bloco')).toBeNull());
  });

  it('o passo não salva com o campo obrigatório em branco', async () => {
    get.mockResolvedValue(funnel({ doneSteps: [1] }));
    renderCanvas();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o bloco' }));
    const painel = await screen.findByTestId('painel-do-bloco');
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    expect(await within(painel).findByRole('alert')).toBeTruthy();
    expect(saveFlow).not.toHaveBeenCalled();
  });

  it('quando o último passo fica feito, aparece o "Pronto!"', async () => {
    get.mockResolvedValue(funnel({ doneSteps: [1] }));
    saveFlow.mockResolvedValue({ ...funnel({ doneSteps: [1, 2] }), is_enabled: true });
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Editar Espera'));
    const painel = await screen.findByTestId('painel-do-bloco');
    // Espera do funil é em segundos.
    expect(within(painel).getByLabelText('Quanto tempo')).toHaveProperty('value', '5');
    // Tirar e pôr a foto passa pelo guia: aqui simulamos o servidor devolvendo tudo feito ao salvar.
    fireEvent.change(within(painel).getByLabelText('Quanto tempo'), { target: { value: '8' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalled());
    expect(await screen.findByText('Pronto! Seu funil já pode ser disparado nas conversas.')).toBeTruthy();
    expect(screen.queryByTestId('checklist-do-guia')).toBeNull();
  });

  it('ligar com passo pendente é recusado com o passo que falta', async () => {
    get.mockResolvedValue(funnel());
    renderCanvas();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ligar o funil' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Falta terminar o guia antes de ligar: Passo 1 de 2 — Escreva a mensagem de abertura.',
    ));
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('canvas no modo guiado (corretor)', () => {
  it('sem Blocos, sem Simular, sem duplicar; Excluir só em mensagem; o Início é fixo', async () => {
    get.mockResolvedValue(funnel());
    renderCanvas();
    await screen.findByTestId('bloco-inicio');
    expect(screen.queryByRole('button', { name: /Blocos/ })).toBeNull();
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
    expect(screen.queryByRole('button', { name: /Simular/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Configurações/ })).toBeNull();
    expect(screen.queryByLabelText(/^Duplicar /)).toBeNull();
    expect(screen.getByLabelText('Excluir Abertura')).toBeTruthy();
    expect(screen.queryByLabelText('Excluir Espera')).toBeNull();
    expect(screen.getByLabelText(/^Início\. Quando: Você dispara o funil numa conversa/)).toBeTruthy();
    expect(screen.queryByLabelText(/Abrir o gatilho/)).toBeNull();
  });

  it('tirar mensagem pergunta, religa as pontas e grava', async () => {
    get.mockResolvedValue(funnel());
    saveFlow.mockResolvedValue(funnel());
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Excluir Abertura'));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar' }));
    await waitFor(() => expect(saveFlow).toHaveBeenCalledTimes(1));
    const [, payload] = saveFlow.mock.calls[0];
    expect(payload.nodes.map((n: { id: string }) => n.id)).toEqual(['w1', 'm2']);
    expect(payload.initial_node_id).toBe('w1');
  });

  it('a mensagem de recusa do servidor aparece como veio', async () => {
    get.mockResolvedValue(funnel());
    saveFlow.mockRejectedValue({ response: { status: 422, data: { errors: ['O funil precisa de pelo menos uma mensagem.'] } } });
    renderCanvas();
    fireEvent.click(await screen.findByLabelText('Excluir Abertura'));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('O funil precisa de pelo menos uma mensagem.'));
  });
});

describe('funil da equipe pra quem não edita', () => {
  it('só ver: sem Salvar nem chave, e "Duplicar pra ter a sua cópia" abre a cópia', async () => {
    get.mockResolvedValue(funnel({ team: true, permissions: { can_edit: false, guided: true } }));
    duplicate.mockResolvedValue({ id: 'copia-1' });
    renderCanvas();
    expect((await screen.findByTestId('faixa-so-ver')).textContent).toContain('só o gestor edita');
    expect(screen.queryByRole('button', { name: /^Salvar$/ })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByTestId('faixa-do-guia')).toBeNull();
    expect(screen.queryByLabelText('Editar Abertura')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Duplicar pra ter a sua cópia/ }));
    await waitFor(() => expect(duplicate).toHaveBeenCalledWith('fa1'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('copia-1'));
  });
});
