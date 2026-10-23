import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const modelosTeam = vi.hoisted(() => ({ last: 'nunca' as unknown }));
vi.mock('@/components/flowAutomations/FlowTemplates', () => ({
  FlowTemplateList: () => null,
  FlowTemplatesDialog: ({ open, team }: { open: boolean; team?: boolean }) => {
    if (open) modelosTeam.last = team;
    return null;
  },
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

// Cartão único (23/10/2026): à vista só ligar/desligar e Editar (ou "Ver");
// Duplicar, Arquivar, Passar/Tirar da equipe e Excluir moram no ⋮.
const abrirMenu = async (item: HTMLElement, nome: string) => {
  await userEvent.click(within(item).getByRole('button', { name: `Mais ações de ${nome}` }));
  return screen.findByRole('menu');
};
const itensDoMenu = (menu: HTMLElement) => within(menu).getAllByRole('menuitem').map(i => i.textContent?.trim());

describe('corretor', () => {
  it('vê Minhas e Da equipe; a da equipe é só leitura: Ver e, no ⋮, só Duplicar', async () => {
    list.mockResolvedValue([flow('a1', 'Boas-vindas'), teamFlow('a2', 'Lembrete de visita')]);
    renderPage();
    expect(await screen.findByText('Boas-vindas')).toBeTruthy();
    expect(screen.queryByText('Lembrete de visita')).toBeNull();
    expect(screen.getByRole('tab', { name: /Minhas \(1\)/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Todas|Dos corretores/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Da equipe \(1\)/ }));
    const item = (await screen.findByText('Lembrete de visita')).closest('li')!;
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    for (const t of ['Ligar', 'Desligar', 'Editar']) expect(within(item).queryByLabelText(t)).toBeNull();
    expect(within(item).queryByRole('switch')).toBeNull();
    const menu = await abrirMenu(item, 'Lembrete de visita');
    expect(itensDoMenu(menu)).toEqual(['Duplicar pra ter a sua cópia']);
  });

  it('a minha: ligar/desligar e Editar à vista; Duplicar, Arquivar e Excluir no ⋮', async () => {
    list.mockResolvedValue([flow('a1', 'Boas-vindas')]);
    renderPage();
    const item = (await screen.findByText('Boas-vindas')).closest('li')!;
    expect(within(item).getByLabelText('Desligar')).toBeTruthy();
    expect(within(item).getByLabelText('Editar')).toBeTruthy();
    expect(within(item).queryByText(/ATIVO|DESLIGADO/)).toBeNull();
    const menu = await abrirMenu(item, 'Boas-vindas');
    expect(itensDoMenu(menu)).toEqual(['Duplicar', 'Arquivar', 'Excluir']);
  });

  it('"Nova automação" cria direto, sem perguntar e sem team', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue({ id: 'n1' });
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /Nova automação/ }))[0]);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('radiogroup')).toBeNull();
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
    for (const t of ['Ligar', 'Desligar', 'Editar']) expect(within(item).queryByLabelText(t)).toBeNull();
    const menu = await abrirMenu(item, 'Sem perms');
    expect(itensDoMenu(menu)).toEqual(['Duplicar pra ter a sua cópia']);
  });

  it('gestor: can_edit false não mostra botões de edição', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Travada', { permissions: { can_edit: false, guided: false, can_mark_team: false, can_create_blank: true, personal: false } })]);
    renderPage();
    const item = (await screen.findByText('Travada')).closest('li')!;
    expect(within(item).getByRole('button', { name: 'Ver' })).toBeTruthy();
    for (const t of ['Ligar', 'Desligar', 'Editar']) expect(within(item).queryByLabelText(t)).toBeNull();
    const menu = await abrirMenu(item, 'Travada');
    expect(itensDoMenu(menu)).toEqual(['Duplicar pra ter a sua cópia']);
  });

  it('gestor: item sem permissions segue editável e cai em Da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Antiga', { permissions: undefined })]);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Da equipe \(1\)/ }));
    const item = (await screen.findByText('Antiga')).closest('li')!;
    const menu = await abrirMenu(item, 'Antiga');
    expect(itensDoMenu(menu)).toEqual(['Duplicar', 'Arquivar', 'Excluir']);
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

  it('"Da equipe" aparece uma vez só no cartão, como selo, sem chave', async () => {
    can.manager = true;
    list.mockResolvedValue([teamFlow('a3', 'Da casa', { permissions: { ...mgrPerms, personal: false } })]);
    renderPage();
    const item = (await screen.findByText('Da casa')).closest('li')!;
    expect(within(item).getAllByText('Da equipe')).toHaveLength(1);
    expect(within(item).queryByRole('switch')).toBeNull();
  });

  it('"Passar pra equipe" no ⋮', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true } })]);
    update.mockResolvedValue({});
    renderPage();
    const item = (await screen.findByText('Minha')).closest('li')!;
    const menu = await abrirMenu(item, 'Minha');
    expect(itensDoMenu(menu)).toEqual(['Duplicar', 'Arquivar', 'Passar pra equipe', 'Excluir']);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Passar pra equipe' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { team: true }));
  });

  // Revisão final (I3): tirar "Da equipe" pergunta antes, e a lista fica com o
  // que o servidor devolveu (sem dono, a automação passa a ser de quem tirou).
  it('"Tirar da equipe": pergunta antes e usa a resposta do servidor', async () => {
    can.manager = true;
    list.mockResolvedValue([teamFlow('a3', 'Da casa', { permissions: { ...mgrPerms, personal: false } })]);
    update.mockResolvedValue(flow('a3', 'Da casa', { team: false, owner_user_id: 'u1', owner_name: 'Eu',
                                                    permissions: { ...mgrPerms, personal: true } }));
    renderPage();
    const item = (await screen.findByText('Da casa')).closest('li')!;
    const menu = await abrirMenu(item, 'Da casa');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tirar da equipe' }));
    expect(await screen.findByText('Tirar da equipe?')).toBeTruthy();
    expect(screen.getByText('Esta automação passa a valer só pros seus leads e a mandar pelo seu WhatsApp.')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Tirar da equipe' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a3', { team: false }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Minhas \(1\)/ })).toBeTruthy());
    expect(screen.getByRole('tab', { name: /Da equipe \(0\)/ })).toBeTruthy();
  });

  it('"Tirar da equipe" da automação de outro dono: o aviso fala dos leads dele', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a2', 'Da Ana', { team: true, owner_user_id: 'u2', owner_name: 'Ana',
                                                    permissions: { ...mgrPerms, personal: false } })]);
    renderPage();
    const item = (await screen.findByText('Da Ana')).closest('li')!;
    const menu = await abrirMenu(item, 'Da Ana');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tirar da equipe' }));
    expect(await screen.findByText('Esta automação passa a valer só pros leads de Ana e a mandar pelo WhatsApp de Ana.')).toBeTruthy();
  });

  it('cancelar a pergunta não muda nada', async () => {
    can.manager = true;
    list.mockResolvedValue([teamFlow('a3', 'Da casa', { permissions: { ...mgrPerms, personal: false } })]);
    renderPage();
    const item = (await screen.findByText('Da casa')).closest('li')!;
    const menu = await abrirMenu(item, 'Da casa');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tirar da equipe' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Tirar da equipe?')).toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect(within(item).getByText('Da equipe')).toBeTruthy();
  });

  // Ajuste do dono do produto (16/10/2026): bloco preso a número específico.
  it('"Tirar da equipe" apagado quando a automação manda por número específico, com o porquê', async () => {
    can.manager = true;
    list.mockResolvedValue([
      teamFlow('a3', 'Presa', { permissions: { ...mgrPerms, personal: false, fixed_number: true } }),
    ]);
    renderPage();
    const item = (await screen.findByText('Presa')).closest('li')!;
    expect(within(item).queryByText(/número específico/)).toBeNull();
    const menu = await abrirMenu(item, 'Presa');
    const tirar = within(menu).getByRole('menuitem', { name: /Tirar da equipe/ });
    expect(tirar.getAttribute('aria-disabled')).toBe('true');
    expect(within(tirar).getByText('Esta automação manda por um número específico. Pra virar pessoal, troque o número nos blocos.')).toBeTruthy();
    fireEvent.click(tirar);
    expect(screen.queryByText('Tirar da equipe?')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('pessoal com bloco de número específico ainda pode virar da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true, fixed_number: true } })]);
    update.mockResolvedValue({});
    renderPage();
    const item = (await screen.findByText('Minha')).closest('li')!;
    const menu = await abrirMenu(item, 'Minha');
    const passar = within(menu).getByRole('menuitem', { name: 'Passar pra equipe' });
    expect(passar.getAttribute('aria-disabled')).toBeNull();
    expect(within(menu).queryByText(/número específico/)).toBeNull();
    await userEvent.click(passar);
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { team: true }));
  });

  it('"Nova automação" pergunta de quem é: Da equipe (padrão) ou Só minha', async () => {
    can.manager = true;
    list.mockResolvedValue([flow('a1', 'Minha', { permissions: { ...mgrPerms, personal: true } })]);
    create.mockResolvedValue({ id: 'n1' });
    renderPage();
    await screen.findByText('Minha');
    expect(screen.queryByRole('button', { name: /Nova pessoal|Nova da equipe/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Nova automação/ }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('radio', { name: /Da equipe/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(janela).getByRole('radio', { name: /Só minha/ }));
    fireEvent.click(within(janela).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ team: false })));
  });

  it('"Nova automação" sem mexer na escolha cria da equipe', async () => {
    can.manager = true;
    list.mockResolvedValue([]);
    create.mockResolvedValue({ id: 'n1' });
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /Nova automação/ }))[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ team: true })));
  });
});

describe('modelos: o gestor leva a aba pro servidor', () => {
  const abrirModelos = async (aba?: RegExp) => {
    modelosTeam.last = 'nunca';
    list.mockResolvedValue([flow('a1', 'Minha'), teamFlow('a2', 'Da casa')]);
    renderPage();
    await screen.findByRole('tab', { name: /Minhas/ });
    if (aba) fireEvent.click(screen.getByRole('tab', { name: aba }));
    fireEvent.click(await screen.findByRole('button', { name: /Modelos/ }));
  };

  it('aba Da equipe = team true; Minhas = false; Todas = sem valor', async () => {
    can.manager = true;
    await abrirModelos(/Da equipe/);
    expect(modelosTeam.last).toBe(true);
  });

  it('Minhas = team false', async () => {
    can.manager = true;
    await abrirModelos(/Minhas/);
    expect(modelosTeam.last).toBe(false);
  });

  it('Todas = sem valor (o servidor decide)', async () => {
    can.manager = true;
    await abrirModelos();
    expect(modelosTeam.last).toBeUndefined();
  });

  it('corretor nunca manda team', async () => {
    can.manager = false;
    await abrirModelos();
    expect(modelosTeam.last).toBeUndefined();
  });
});

describe('leads pausados por outro número', () => {
  it('todos veem o texto; só quem edita o fluxo vê Resolver', async () => {
    can.manager = true;
    list.mockResolvedValue([
      flow('a1', 'Boas-vindas', { paused_other_number_count: 2 }),
      teamFlow('a2', 'Lembrete de visita', { paused_other_number_count: 1 }),
    ]);
    renderPage();
    const meu = (await screen.findByText('Boas-vindas')).closest('li')!;
    expect(within(meu).getByText('2 leads pausados: já conversam em outro número')).toBeTruthy();
    expect(within(meu).getByRole('button', { name: 'Resolver' })).toBeTruthy();
    const dele = screen.getByText('Lembrete de visita').closest('li')!;
    expect(within(dele).getByText('1 lead pausado: já conversa em outro número')).toBeTruthy();
    expect(within(dele).queryByRole('button', { name: 'Resolver' })).toBeNull();
  });
});
