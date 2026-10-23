import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 4 (04/10/2026), parte B: a página Funis de mensagem, sem
// abas internas, com "Meus funis" / "Da equipe" e o "+ Novo funil" pelos modelos.

const list = vi.hoisted(() => vi.fn());
const templates = vi.hoisted(() => vi.fn());
const applyTemplate = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const can = vi.hoisted(() => ({ manager: false }));

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list, templates, applyTemplate, create, update, toggle: vi.fn(), duplicate: vi.fn(), destroy: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => can.manager && `${resource}.${action}` === 'flow_automations.update',
}));

import ConversationFunnels from './ConversationFunnels';

const perms = (manager: boolean, own = true) => ({
  can_edit: manager || own, guided: !manager, can_mark_team: manager, can_create_blank: manager,
});

const funnel = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id, name, kind: 'conversation', is_enabled: true, archived_at: null, team: false, owner_name: 'Ana',
  guide_pending: [], permissions: perms(false), trigger: { event: 'conversation.manual', conditions: [] }, ...patch,
});

const MODELO = {
  key: 'funil_apresentacao_imovel', name: 'Apresentação do imóvel', description: 'Abre a conversa falando do imóvel.',
  guide_steps: 3,
  preview: [
    { kind: 'send_whatsapp', label: 'Abertura', text: 'Oi {{nome}}, separei um imóvel' },
    { kind: 'wait', label: 'Espera', seconds: 5 },
    { kind: 'send_whatsapp', label: 'Foto do imóvel', media_kind: 'image' },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/automations/message-funnels']}>
      <Routes>
        <Route path="/automations/message-funnels" element={<ConversationFunnels />} />
        <Route path="/automations/message-funnels/:id" element={<p>canvas do funil</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  list.mockReset();
  templates.mockReset();
  applyTemplate.mockReset();
  create.mockReset();
  update.mockReset();
  can.manager = false;
});

describe('Meus funis e Da equipe', () => {
  it('duas listas empilhadas (Da equipe e Meus funis), sem fileira de abas', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Primeiro contato'),
      funnel('f2', 'Pós-visita', { guide_pending: [{ node_id: 'n', step: 2, total: 3, title: 'x' }], is_enabled: false }),
      funnel('f3', 'Pedir documentos', { team: true, permissions: perms(false, false) }),
    ]);
    renderPage();
    expect(await screen.findByText('Primeiro contato')).toBeTruthy();
    expect(screen.getByText('Termine de montar: passo 2 de 3')).toBeTruthy();
    // Aba dentro de aba foi recusada: a moldura já tem "Manual | Follow-up".
    expect(screen.queryByRole('tab')).toBeNull();
    expect(list).toHaveBeenCalledWith({ kind: 'conversation' });

    const meus = screen.getByRole('list', { name: 'Meus funis' });
    expect(within(meus).getByText('Primeiro contato')).toBeTruthy();
    expect(within(meus).queryByText('Pedir documentos')).toBeNull();
    const equipe = screen.getByRole('list', { name: 'Da equipe' });
    const item = within(equipe).getByText('Pedir documentos').closest('li')!;
    // Corretor: o da equipe não edita (sem chave nem Excluir), só vê e duplica.
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(within(item).getByLabelText('Duplicar pra ter a sua cópia')).toBeTruthy();
    expect(within(item).queryByLabelText('Excluir')).toBeNull();
    expect(within(item).queryByRole('switch')).toBeNull();
  });

  it('lista vazia de um lado mostra o aviso daquela lista e mantém a outra', async () => {
    list.mockResolvedValue([funnel('f1', 'Primeiro contato')]);
    renderPage();
    await screen.findByText('Primeiro contato');
    expect(screen.getByText(/Nenhum funil da equipe/)).toBeTruthy();
    expect(screen.queryByText('Nenhum funil ainda')).toBeNull();
  });

  it('o corretor não vê a chave "Da equipe"; o gestor vê e marca', async () => {
    list.mockResolvedValue([funnel('f1', 'Primeiro contato')]);
    renderPage();
    await screen.findByText('Primeiro contato');
    expect(screen.queryByRole('switch', { name: 'Da equipe' })).toBeNull();
  });

  it('gestor marca como da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([funnel('f1', 'Primeiro contato', { permissions: perms(true) })]);
    update.mockResolvedValue({});
    renderPage();
    await screen.findByText('Primeiro contato');
    fireEvent.click(screen.getByRole('switch', { name: 'Da equipe' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('f1', { team: true }));
  });
});

describe('Um título, um cartão (22/10/2026)', () => {
  const SUBTITULO =
    'Sequências de mensagens prontas. As manuais você dispara numa conversa; o follow-up vai atrás do lead que parou de responder.';

  it('título e subtítulo fixos, botão e busca da aba Manual', async () => {
    list.mockResolvedValue([funnel('f1', 'Primeiro contato')]);
    renderPage();
    await screen.findByText('Primeiro contato');
    expect(screen.getByRole('heading', { name: 'Funis de mensagem' })).toBeTruthy();
    expect(screen.getByText(SUBTITULO)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Novo funil/ }).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Buscar funil...')).toBeTruthy();
  });

  it('as listas usam a grade de 3 colunas e o cartão compartilhado, com o filete do estado', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Primeiro contato'),
      funnel('f2', 'Pós-visita', { is_enabled: false }),
      funnel('f3', 'Documentos', { guide_pending: [{ node_id: 'n', step: 2, total: 3, title: 'x' }], is_enabled: false }),
    ]);
    renderPage();
    await screen.findByText('Primeiro contato');
    const grade = screen.getByRole('list', { name: 'Meus funis' });
    expect(grade.className).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    const cartoes = screen.getAllByTestId('cartao-de-fluxo');
    expect(cartoes).toHaveLength(3);
    const estadoDe = (nome: string) => screen.getByText(nome).closest('[data-testid="cartao-de-fluxo"]')!.getAttribute('data-estado');
    expect(estadoDe('Primeiro contato')).toBe('ligado');
    expect(estadoDe('Pós-visita')).toBe('desligado');
    expect(estadoDe('Documentos')).toBe('montando');
    const montando = screen.getByText('Documentos').closest('[data-testid="cartao-de-fluxo"]') as HTMLElement;
    expect(within(montando).getByText('Termine de montar: passo 2 de 3')).toBeTruthy();
    expect(within(montando).getByTestId('filete-do-cartao').className).toContain('bg-amber-500');
  });
});

describe('+ Novo funil', () => {
  it('mostra os modelos com a sequência e "Usar este modelo" abre o canvas do funil criado', async () => {
    list.mockResolvedValue([]);
    templates.mockResolvedValue([MODELO]);
    applyTemplate.mockResolvedValue({ id: 'novo-1', name: 'Apresentação do imóvel' });
    renderPage();
    // O "+ Novo funil" do topo (o estado vazio tem outro igual).
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo funil/ }))[0]);
    const modelos = await screen.findByRole('listbox', { name: 'Modelos' });
    expect(within(modelos).getByRole('option', { name: /Apresentação do imóvel/ })).toBeTruthy();
    expect(templates).toHaveBeenCalledWith('conversation');
    // O primeiro modelo já vem escolhido, com a sequência à mostra.
    const sequencia = screen.getByRole('list', { name: /Sequência do modelo/ });
    expect(sequencia.textContent).toContain('Oi {{nome}}, separei um imóvel');
    expect(sequencia.textContent).toContain('Espera 5 segundos');
    expect(sequencia.textContent).toContain('Foto');
    // Corretor não começa do zero.
    expect(screen.queryByRole('button', { name: 'Começar do zero' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este modelo' }));
    await waitFor(() => expect(applyTemplate).toHaveBeenCalledWith('funil_apresentacao_imovel'));
    expect(await screen.findByText('canvas do funil')).toBeTruthy();
  });

  it('o gestor também começa do zero', async () => {
    can.manager = true;
    list.mockResolvedValue([]);
    templates.mockResolvedValue([MODELO]);
    create.mockResolvedValue({ id: 'zero-1' });
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo funil/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Começar do zero' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Novo funil', kind: 'conversation' }));
    expect(await screen.findByText('canvas do funil')).toBeTruthy();
  });
});
