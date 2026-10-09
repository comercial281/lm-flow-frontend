import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonSheet from './PersonSheet';
import { buildCargoOptions } from '../cargoOptions';
import type { MemberNumber, TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';
import type { CustomRole } from '@/types/customRoles';

const s = vi.hoisted(() => ({
  perms: new Set<string>(),
  viewerId: 'g1' as string | null,
  isSuper: false,
  updateUser: vi.fn(),
  sendAccess: vi.fn(),
  accessLink: vi.fn(),
  reactivate: vi.fn(),
  membersGet: vi.fn(),
  membersUpdate: vi.fn(),
  membersAdd: vi.fn(),
  membersRemove: vi.fn(),
  setUserPrimary: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: s.toastSuccess, error: s.toastError, message: s.toastMessage } }));
// Lista do sistema (celular): o Seletor vira <select>, que o teste sabe escolher.
vi.mock('@/hooks/usePonteiroDeToque', () => ({ usePonteiroDeToque: () => true }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ can: (r: string, a: string) => s.perms.has(`${r}.${a}`) }),
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => s.isSuper }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ currentUser: s.viewerId ? { id: s.viewerId, name: 'Quem vê' } : null }),
}));
vi.mock('@/services/users', () => ({
  usersService: {
    updateUser: s.updateUser, sendAccess: s.sendAccess, accessLink: s.accessLink, reactivate: s.reactivate,
  },
}));
vi.mock('@/services/channels/inboxMembersService', () => ({
  default: { get: s.membersGet, update: s.membersUpdate, add: s.membersAdd, remove: s.membersRemove },
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { setUserPrimary: s.setUserPrimary } }));
vi.mock('@/utils/clipboard', () => ({ copyText: vi.fn(async () => true) }));
// As janelas de hoje têm teste próprio; aqui só importa que a ficha as abre.
vi.mock('@/components/users/DeactivateUserDialog', () => ({
  default: ({ open, user }: { open: boolean; user: { name: string } | null }) =>
    (open ? <div role="dialog" aria-label="janela desativar">{user?.name}</div> : null),
}));
vi.mock('@/components/users/EraseUserDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="janela excluir" /> : null),
}));

const num = (over: Partial<MemberNumber> = {}): MemberNumber => ({
  inbox_id: '10', name: 'Ana Souza', phone: '5511940871974', connection: 'connected',
  principal: true, never_connected: false, owner: true, ...over,
});

const pessoa = (over: Partial<TeamAccessMember> = {}): TeamAccessMember => ({
  id: 'a1', name: 'Ana Souza', email: 'ana@x.com', whatsapp_number: '11940871974', confirmed: true, availability: 1,
  role: { key: 'agent', name: 'Corretor', chave_role: 'agent' },
  sees_all_inboxes: false, granted_inbox_ids: ['20'], auto_inbox_ids: [], auto_access: {},
  all_numbers: [num(), num({ inbox_id: '20', name: 'Plantão', owner: false, principal: false, connection: 'disconnected' })],
  last_seen_at: null, access_link_until: null,
  ...over,
});

const GERENTE = pessoa({
  id: 'g1', name: 'Gil Gerente', role: { key: 'manager', name: 'Gerente', chave_role: 'manager' }, all_numbers: [],
});
const ADMIN = pessoa({
  id: 'ad1', name: 'Dora Dona', role: { key: 'admin', name: 'Administrador', chave_role: 'admin' },
  sees_all_inboxes: true, all_numbers: [],
});
const OUTRO_GERENTE = pessoa({
  id: 'g2', name: 'Hugo Gerente', role: { key: 'manager', name: 'Gerente', chave_role: 'manager' }, all_numbers: [],
});
const ANA = pessoa();

const INBOXES: TeamAccessInbox[] = [
  { id: '10', name: 'Ana Souza', phone: '5511940871974', connection: 'connected' },
  { id: '20', name: 'Plantão', phone: null, connection: 'disconnected' },
  { id: '30', name: 'Comercial', phone: '5511988887777', connection: 'connected' },
];

const role = (over: Partial<CustomRole>): CustomRole => ({
  id: 1, name: 'Cargo', slug: 'cargo', description: '', color: 'blue', permissions: [], effective_permissions: [],
  system: false, users_count: 0, ...over,
} as CustomRole);
const ROLES = buildCargoOptions([role({ id: 9, name: 'SDR', slug: 'sdr' })]);

function abrir(member: TeamAccessMember = ANA, over: Partial<React.ComponentProps<typeof PersonSheet>> = {}) {
  const props = {
    member,
    members: [ADMIN, GERENTE, OUTRO_GERENTE, ANA],
    inboxes: INBOXES,
    roles: ROLES,
    numberOwnerRule: true,
    onClose: vi.fn(),
    onChanged: vi.fn(),
    onCreateNumber: vi.fn(),
    ...over,
  };
  render(<PersonSheet {...props} />);
  return props;
}

const tudo = ['users.update', 'users.send_access', 'users.deactivate', 'channels.create', 'inboxes.update'];

beforeEach(() => {
  vi.clearAllMocks();
  s.perms = new Set(tudo);
  s.viewerId = 'g1';
  s.isSuper = false;
  s.updateUser.mockResolvedValue({});
  s.membersGet.mockResolvedValue([{ id: 'a1' }, { id: 'x9' }]);
  s.membersUpdate.mockResolvedValue({});
  s.membersAdd.mockResolvedValue(undefined);
  s.membersRemove.mockResolvedValue(undefined);
});

describe('PersonSheet — quem pode mexer', () => {
  it('com users.update, cargo, celular e números são editáveis e há um Salvar', () => {
    abrir();
    expect(screen.getByRole('combobox', { name: 'Cargo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Celular' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Liberar outro número' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('sem users.update, a ficha é só leitura: valores como texto e nada de Salvar', () => {
    s.perms = new Set(['users.deactivate']);
    abrir();
    expect(screen.queryByRole('combobox', { name: 'Cargo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Celular' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Liberar outro número' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tirar Plantão/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar link' })).not.toBeInTheDocument();
    expect(screen.getByText('Corretor')).toBeInTheDocument();
    expect(screen.getAllByText('(11) 94087-1974').length).toBeGreaterThan(0);
  });

  it('quem não é administrador vê só leitura num gerente que não é ele mesmo', () => {
    s.viewerId = 'g1';
    abrir(OUTRO_GERENTE);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Celular' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reenviar link|Enviar link/ })).not.toBeInTheDocument();
    expect(screen.getByText('Seu cargo só mexe no cadastro de corretores.')).toBeInTheDocument();
  });

  it('o gerente mexe no próprio cadastro', () => {
    s.viewerId = 'g1';
    abrir(GERENTE);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('o administrador mexe em qualquer um', () => {
    s.viewerId = 'ad1';
    abrir(OUTRO_GERENTE);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('quem não é administrador não vê a opção Administrador', () => {
    abrir();
    const opcoes = within(screen.getByRole('combobox', { name: 'Cargo' })).getAllByRole('option').map(o => o.textContent);
    expect(opcoes).not.toContain('Administrador');
    expect(opcoes).toEqual(expect.arrayContaining(['Gerente', 'Corretor', 'SDR']));
  });

  it('o administrador vê a opção Administrador', () => {
    s.viewerId = 'ad1';
    abrir();
    const opcoes = within(screen.getByRole('combobox', { name: 'Cargo' })).getAllByRole('option').map(o => o.textContent);
    expect(opcoes).toContain('Administrador');
  });
});

describe('PersonSheet — números', () => {
  it('dono do número não tem botão de tirar; o liberado tem', () => {
    abrir();
    expect(screen.getByText('Dono do número')).toBeInTheDocument();
    expect(screen.getByText('Atende as conversas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar Ana Souza de Ana Souza' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar Plantão de Ana Souza' })).toBeInTheDocument();
  });

  it('"Liberar outro número" só oferece o que ela ainda não tem', () => {
    abrir();
    const opcoes = within(screen.getByRole('combobox', { name: 'Liberar outro número' }))
      .getAllByRole('option').map(o => o.textContent);
    expect(opcoes.some(o => o?.includes('Comercial'))).toBe(true);
    expect(opcoes.some(o => o?.includes('Plantão'))).toBe(false);
  });

  it('"Criar número novo" chama o atalho com a pessoa', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Criar número novo para Ana Souza' }));
    expect(props.onCreateNumber).toHaveBeenCalledWith(ANA);
  });

  it('sem channels.create, o "Criar número novo" some', () => {
    s.perms = new Set(['users.update']);
    abrir();
    expect(screen.queryByRole('button', { name: /Criar número novo/ })).not.toBeInTheDocument();
  });

  it('com a regra do dono e dois números próprios, escolhe o principal na hora', async () => {
    s.setUserPrimary.mockResolvedValue([]);
    const dois = pessoa({ all_numbers: [num(), num({ inbox_id: '11', name: 'Ana 2', principal: false })] });
    const props = abrir(dois);
    await userEvent.click(screen.getByRole('button', { name: 'Tornar principal' }));
    expect(s.setUserPrimary).toHaveBeenCalledWith('a1', '11');
    await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
  });
});

describe('PersonSheet — Salvar manda só o que mudou', () => {
  it('só o celular mudou: um PATCH só com o celular, nenhum número mexido', async () => {
    const props = abrir();
    const campo = screen.getByRole('textbox', { name: 'Celular' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '11 98888 7777');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.updateUser).toHaveBeenCalledWith('a1', { whatsapp_number: '11 98888 7777' }));
    expect(s.membersUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
  });

  it('mudou o cargo: manda o cargo, e só ele', async () => {
    abrir();
    const corretor = ROLES.find(o => o.chaveRole === 'agent')!;
    const gerente = ROLES.find(o => o.chaveRole === 'manager')!;
    expect(corretor).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Cargo' }), gerente.key);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.updateUser).toHaveBeenCalledWith('a1', { chave_role: 'manager' }));
  });

  it('tirou um número e liberou outro: mexe só nesses dois, só nesta pessoa, sem PATCH da pessoa', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Plantão de Ana Souza' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Liberar outro número' }), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.membersAdd).toHaveBeenCalledWith('30', ['a1']));
    expect(s.membersRemove).toHaveBeenCalledWith('20', ['a1']);
    expect(s.membersAdd).toHaveBeenCalledTimes(1);
    expect(s.membersRemove).toHaveBeenCalledTimes(1);
    expect(s.updateUser).not.toHaveBeenCalled();
  });

  // Ler a lista e devolvê-la inteira (GET + PATCH) apagava todo mundo do número
  // quando a leitura falhava (o GET devolve [] no erro) e promovia à distribuição
  // quem só tinha acesso automático. A ficha nunca faz isso.
  it('nunca lê a lista do número nem a regrava inteira', async () => {
    s.membersGet.mockResolvedValue([]);
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Plantão de Ana Souza' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Liberar outro número' }), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.membersAdd).toHaveBeenCalled());
    expect(s.membersGet).not.toHaveBeenCalled();
    expect(s.membersUpdate).not.toHaveBeenCalled();
  });

  it('falha ao liberar: frase do servidor, ficha aberta', async () => {
    s.membersAdd.mockRejectedValue({ response: { data: { error: { message: 'Sem permissão para isso.' } } } });
    const props = abrir();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Liberar outro número' }), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.toastError).toHaveBeenCalledWith('Sem permissão para isso.'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onChanged).toHaveBeenCalled();
  });

  // Liberar (POST) e tirar (DELETE /inbox_members) são cobrados como
  // inboxes.update: sem a chave, a ficha não oferece o que o servidor recusa.
  it('sem inboxes.update não oferece tirar nem liberar', () => {
    s.perms = new Set(['users.update']);
    abrir();
    expect(screen.queryByRole('button', { name: 'Tirar Plantão de Ana Souza' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Liberar outro número' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Celular' })).toBeInTheDocument();
  });

  it('nada mudou: Salvar fica desligado', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('a recusa do servidor aparece como veio', async () => {
    s.updateUser.mockRejectedValue({ response: { data: { error: { message: 'Seu cargo só mexe no cadastro de corretores.' } } } });
    const props = abrir();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Cargo' }), ROLES.find(o => o.chaveRole === 'manager')!.key);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.toastError).toHaveBeenCalledWith('Seu cargo só mexe no cadastro de corretores.'));
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe('PersonSheet — acesso e desativar', () => {
  it('Desativar pessoa abre a janela de hoje', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Desativar pessoa' }));
    expect(screen.getByRole('dialog', { name: 'janela desativar' })).toBeInTheDocument();
  });

  it('Excluir cadastro abre a janela que pergunta ao servidor', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir cadastro' }));
    expect(screen.getByRole('dialog', { name: 'janela excluir' })).toBeInTheDocument();
  });

  it('pessoa inativa: Reativar no lugar de Desativar', async () => {
    s.reactivate.mockResolvedValue({});
    const props = abrir(pessoa({ deactivated: true }));
    expect(screen.queryByRole('button', { name: 'Desativar pessoa' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    expect(s.reactivate).toHaveBeenCalledWith('a1');
    await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
  });

  it('Reenviar link usa o celular do campo, depois de confirmar', async () => {
    s.sendAccess.mockResolvedValue({ whatsapp: { sent: true } });
    abrir();
    const campo = screen.getByRole('textbox', { name: 'Celular' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '11977776666');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));
    // O celular do campo é diferente do cadastro: o envio grava o novo.
    expect(await screen.findByText(/Esse celular fica gravado no cadastro\./)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(s.sendAccess).toHaveBeenCalledWith('a1', { whatsapp_number: '11977776666' }));
  });

  it('com o celular do cadastro, a confirmação não fala em gravar', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));
    expect(await screen.findByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(screen.queryByText(/fica gravado no cadastro/)).not.toBeInTheDocument();
  });

  it('sem users.send_access não há envio de link', () => {
    s.perms = new Set(['users.update']);
    abrir();
    expect(screen.queryByRole('button', { name: /Enviar link|Reenviar link/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
  });
});

describe('PersonSheet — fechar com alteração por salvar', () => {
  it('sem alteração, fecha direto', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('com alteração, pergunta; "Continuar editando" mantém, "Descartar" fecha', async () => {
    const props = abrir();
    await userEvent.type(screen.getByRole('textbox', { name: 'Celular' }), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(props.onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });
});
