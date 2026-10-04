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
  it('separa os meus dos da equipe, sem abas de Variáveis/Atributos', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Primeiro contato'),
      funnel('f2', 'Pós-visita', { guide_pending: [{ node_id: 'n', step: 2, total: 3, title: 'x' }], is_enabled: false }),
      funnel('f3', 'Pedir documentos', { team: true, permissions: perms(false, false) }),
    ]);
    renderPage();
    expect(await screen.findByText('Primeiro contato')).toBeTruthy();
    expect(screen.getByText('Termine de montar: passo 2 de 3')).toBeTruthy();
    expect(screen.queryByText('Pedir documentos')).toBeNull();
    expect(screen.queryByRole('tab', { name: /Variáveis|Atributos/ })).toBeNull();
    expect(list).toHaveBeenCalledWith({ kind: 'conversation' });

    fireEvent.click(screen.getByRole('tab', { name: /Da equipe \(1\)/ }));
    const item = (await screen.findByText('Pedir documentos')).closest('li')!;
    // Corretor: o da equipe não edita (sem chave nem Excluir), só vê e duplica.
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(within(item).getByLabelText('Duplicar pra ter a sua cópia')).toBeTruthy();
    expect(within(item).queryByLabelText('Excluir')).toBeNull();
    expect(within(item).queryByRole('switch')).toBeNull();
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

describe('+ Novo funil', () => {
  it('mostra os modelos com a sequência e "Usar este modelo" abre o canvas do funil criado', async () => {
    list.mockResolvedValue([]);
    templates.mockResolvedValue([MODELO]);
    applyTemplate.mockResolvedValue({ id: 'novo-1', name: 'Apresentação do imóvel' });
    renderPage();
    // O "+ Novo funil" do topo (o estado vazio tem outro igual).
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo funil/ }))[0]);
    const modelos = await screen.findByRole('list', { name: 'Modelos de funil' });
    expect(within(modelos).getByText('Apresentação do imóvel')).toBeTruthy();
    expect(templates).toHaveBeenCalledWith('conversation');
    const sequencia = within(modelos).getByRole('list', { name: /Sequência do modelo/ });
    expect(sequencia.textContent).toContain('Oi {{nome}}, separei um imóvel');
    expect(sequencia.textContent).toContain('Espera 5 segundos');
    expect(sequencia.textContent).toContain('Foto');
    // Corretor não começa do zero.
    expect(screen.queryByRole('button', { name: 'Começar do zero' })).toBeNull();
    fireEvent.click(within(modelos).getByRole('button', { name: 'Usar este modelo' }));
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
