import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações por cargo (15/10/2026): a lista ganha dono e equipe. Corretor vê
// "Minhas" / "Da equipe" (a da equipe só leitura); gestor vê também "Dos corretores".

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const duplicate = vi.hoisted(() => vi.fn());
const foldersList = vi.hoisted(() => vi.fn());
const can = vi.hoisted(() => ({ manager: false }));

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list, create, update, duplicate, toggle: vi.fn(), get: vi.fn(), archive: vi.fn(), destroy: vi.fn() },
  flowAutomationFoldersService: { list: foldersList },
}));
vi.mock('@/components/flowAutomations/FlowTemplates', () => ({
  FlowTemplateList: () => null,
  FlowTemplatesDialog: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (resource: string, action: string) => {
    if (resource !== 'flow_automations') return false;
    return can.manager ? action === 'update' : action === 'own';
  },
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1' } }),
}));

import FlowAutomationsList from './FlowAutomationsList';

const flow = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id, name, kind: 'automation', is_enabled: true, archived_at: null, team: false,
  owner_user_id: 'u1', owner_name: 'Eu',
  permissions: { can_edit: true, guided: false, can_mark_team: false, can_create_blank: true, personal: true },
  trigger: { event: 'lead.created', conditions: [] }, ...patch,
});
const teamFlow = (id: string, name: string, patch: Record<string, unknown> = {}) =>
  flow(id, name, {
    team: true, owner_user_id: null, owner_name: null,
    permissions: { can_edit: false, guided: false, can_mark_team: false, can_create_blank: true, personal: false }, ...patch,
  });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/lista']}>
      <Routes>
        <Route path="/lista" element={<FlowAutomationsList />} />
        <Route path="/automations/flow-builder/:id" element={<p>canvas da automação</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  [list, create, update, duplicate, foldersList].forEach(m => m.mockReset());
  foldersList.mockResolvedValue([]);
  can.manager = false;
});

describe('corretor', () => {
  it('vê Minhas e Da equipe; a da equipe é só leitura, sem chave Ligado, com Duplicar', async () => {
    list.mockResolvedValue([flow('a1', 'Boas-vindas'), teamFlow('a2', 'Lembrete de visita')]);
    renderPage();
    expect(await screen.findByText('Boas-vindas')).toBeTruthy();
    expect(screen.queryByText('Lembrete de visita')).toBeNull();
    expect(screen.getByRole('tab', { name: /Minhas \(1\)/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Todas|Dos corretores/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Da equipe \(1\)/ }));
    const item = (await screen.findByText('Lembrete de visita')).closest('li')!;
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(within(item).getByLabelText('Duplicar pra ter a sua cópia')).toBeTruthy();
    expect(within(item).queryByLabelText('Excluir')).toBeNull();
    expect(within(item).queryByLabelText('Arquivar')).toBeNull();
    expect(within(item).queryByRole('switch')).toBeNull();
  });

  it('cria direto, sem team', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue({ id: 'n1' });
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo fluxo/ }))[0]);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).not.toHaveProperty('team');
    expect(await screen.findByText('canvas da automação')).toBeTruthy();
  });
});

describe('permissions ausente ou negada', () => {
  it('corretor: item sem permissions não ganha Ligar/Arquivar/Excluir', async () => {
    list.mockResolvedValue([flow('a1', 'Sem perms', { permissions: undefined, team: true })]);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Da equipe/ }));
    const item = (await screen.findByText('Sem perms')).closest('li')!;
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(within(item).getByLabelText('Duplicar pra ter a sua cópia')).toBeTruthy();
    for (const t of ['Ligar', 'Desligar', 'Arquivar', 'Excluir']) expect(within(item).queryByTitle(t)).toBeNull();
  });

  it('gestor: can_edit false não mostra botões de edição', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Travada', { permissions: { can_edit: false, guided: false, can_mark_team: false, can_create_blank: true, personal: false } })]);
    renderPage();
    const item = (await screen.findByText('Travada')).closest('li')!;
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    for (const t of ['Ligar', 'Desligar', 'Arquivar', 'Excluir']) expect(within(item).queryByTitle(t)).toBeNull();
  });

  it('gestor: item sem permissions segue editável e cai em Da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Antiga', { permissions: undefined })]);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Da equipe \(1\)/ }));
    const item = (await screen.findByText('Antiga')).closest('li')!;
    expect(within(item).getByTitle('Arquivar')).toBeTruthy();
    expect(within(item).getByTitle('Excluir')).toBeTruthy();
  });
});

describe('gestor', () => {
  const mgrPerms = { can_edit: true, guided: false, can_mark_team: true, can_create_blank: true };

  it('vê Dos corretores com a pessoal de outro e o selo "De Ana"', async () => {
    can.manager = true;
    list.mockResolvedValue([
      flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true } }),
      flow('a2', 'Da Ana', { owner_user_id: 'u2', owner_name: 'Ana', permissions: { ...mgrPerms, personal: true } }),
      teamFlow('a3', 'Da casa', { permissions: { ...mgrPerms, personal: false } }),
    ]);
    renderPage();
    expect(await screen.findByRole('tab', { name: /Todas \(3\)/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Minhas \(1\)/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Da equipe \(1\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Dos corretores \(1\)/ }));
    expect(await screen.findByText('Da Ana')).toBeTruthy();
    expect(screen.getByText('De Ana')).toBeTruthy();
    expect(screen.queryByText('Minha')).toBeNull();
  });

  it('liga "Da equipe" no cartão', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true } })]);
    update.mockResolvedValue({});
    renderPage();
    await screen.findByText('Minha');
    fireEvent.click(screen.getByRole('switch', { name: 'Da equipe' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { team: true }));
  });

  it('cria Pessoal (team false) ou Da equipe (team true)', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true } })]);
    create.mockResolvedValue({ id: 'n1' });
    renderPage();
    await screen.findByText('Minha');
    fireEvent.click(screen.getByRole('button', { name: /Nova pessoal/ }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ team: false })));
  });
});
