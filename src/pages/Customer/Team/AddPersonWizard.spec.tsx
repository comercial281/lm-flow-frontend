import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddPersonWizard from './AddPersonWizard';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox } from '@/types/teamAccess';

const s = vi.hoisted(() => ({
  createUser: vi.fn(),
  createNumber: vi.fn(),
  sendAccess: vi.fn(),
  add: vi.fn(),
  navigate: vi.fn(),
  can: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => s.navigate }));
vi.mock('sonner', () => ({ toast: s.toast }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: s.can }) }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ currentUser: { id: 'me', name: 'Eu' } }) }));
vi.mock('@/services/users', () => ({
  usersService: { createUser: s.createUser, createWhatsappNumber: s.createNumber, sendAccess: s.sendAccess },
}));
vi.mock('@/services/channels/inboxMembersService', () => ({ default: { add: s.add } }));

const inboxes = [
  { id: '5', name: 'Comercial', phone: '5511900000000', connection: 'connected' },
] as unknown as TeamAccessInbox[];
const roles: CustomRole[] = [];

const members = (chave: 'admin' | 'manager') => [
  { id: 'me', name: 'Eu', email: 'eu@x.com', role: { key: chave, name: chave, chave_role: chave } },
] as any;

const grant = (...off: string[]) =>
  s.can.mockImplementation((r: string, a: string) => !off.includes(`${r}.${a}`));

function open(props: Record<string, unknown> = {}) {
  const p = { open: true, roles, inboxes, members: members('admin'), onClose: vi.fn(), onCreated: vi.fn(), ...props };
  render(<AddPersonWizard {...(p as any)} />);
  return p as any;
}

async function preencher(cargo = 'Corretor') {
  await userEvent.type(screen.getByPlaceholderText('Ex: Ana Souza'), 'Ana Souza');
  await userEvent.type(screen.getByPlaceholderText('ana@imobiliaria.com.br'), 'ana@x.com');
  await userEvent.type(screen.getByPlaceholderText('Ex: 11 94087 1974'), '11940871974');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await userEvent.click(screen.getByText(cargo));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

const numeroMarcado = () => screen.queryByRole('checkbox', { name: 'Criar um número novo para Ana Souza' });

describe('AddPersonWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant();
    s.createUser.mockResolvedValue({ id: 'u9' });
    s.createNumber.mockResolvedValue({ inbox_id: '88', name: 'Ana Souza', phone: '5511940871974', connection: null });
    s.add.mockResolvedValue(undefined);
    s.sendAccess.mockResolvedValue({ user: {}, whatsapp: { sent: true } });
  });

  it('com channels.create o bloco do número nasce marcado, com nome e telefone da pessoa', async () => {
    open();
    await preencher();
    expect(numeroMarcado()).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Nome do número' })).toHaveValue('Ana Souza');
    expect(screen.getByRole('textbox', { name: 'Telefone do número' })).toHaveValue('(11) 94087-1974');
    expect(screen.getByText('Também atende números que já existem')).toBeInTheDocument();
  });

  it('sem channels.create o bloco do número não aparece', async () => {
    grant('channels.create');
    open();
    await preencher();
    expect(numeroMarcado()).not.toBeInTheDocument();
  });

  it('sem inboxes.update os números que já existem ficam escondidos', async () => {
    grant('inboxes.update');
    open();
    await preencher();
    expect(screen.queryByText('Também atende números que já existem')).not.toBeInTheDocument();
    expect(numeroMarcado()).toBeChecked();
  });

  it('ordem: pessoa, número, membros, acesso — e mostra o resumo em vez de fechar', async () => {
    const props = open();
    await preencher();
    await userEvent.click(screen.getByRole('checkbox', { name: /Comercial/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar e enviar acesso' }));
    expect(await screen.findByText('Cadastrado como Corretor')).toBeInTheDocument();
    expect(screen.getByText(/Número Ana Souza criado, com Ana Souza como dono/)).toBeInTheDocument();
    expect(s.createNumber).toHaveBeenCalledWith('u9', { name: 'Ana Souza', phone_number: '5511940871974' });
    expect(s.add).toHaveBeenCalledWith('5', ['u9']);
    expect(s.sendAccess).toHaveBeenCalledWith('u9', { whatsapp_number: '11940871974' });
    const order = [s.createUser, s.createNumber, s.add, s.sendAccess].map(f => f.mock.invocationCallOrder[0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onCreated).toHaveBeenCalled();
  });

  it('número falhou: a pessoa fica, o resumo explica e "Tentar de novo" abre a criação do número', async () => {
    s.createNumber.mockRejectedValueOnce({ response: { data: { error: { code: 'limit', message: 'Seu plano permite 3 números.' } } } });
    open();
    await preencher();
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    expect(await screen.findByText(/Número não criado: Seu plano permite 3 números\./)).toBeInTheDocument();
    expect(screen.getByText('Cadastrado como Corretor')).toBeInTheDocument();
    expect(s.createUser).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Criar número para Ana Souza')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Telefone do número' })).toHaveValue('(11) 94087-1974');
  });

  it('"Só cadastrar" sem número: avisa com toast e fecha como antes', async () => {
    const props = open();
    await preencher();
    await userEvent.click(numeroMarcado()!);
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(s.toast.success).toHaveBeenCalledWith('Ana Souza adicionada à equipe.');
    expect(s.createNumber).not.toHaveBeenCalled();
    expect(props.onCreated).toHaveBeenCalled();
  });

  it('duplo clique no botão final cria uma pessoa só', async () => {
    let release!: (v: unknown) => void;
    s.createUser.mockReturnValue(new Promise(r => { release = r; }));
    open();
    await preencher();
    // Dois cliques no mesmo instante (antes do React redesenhar o botão como
    // desabilitado): só a trava interna segura o segundo.
    const btn = screen.getByRole('button', { name: 'Cadastrar e enviar acesso' });
    act(() => { btn.click(); btn.click(); });
    release({ id: 'u9' });
    await screen.findByText('Cadastrado como Corretor');
    expect(s.createUser).toHaveBeenCalledTimes(1);
  });

  it('quem não é administrador não vê o cargo Administrador', async () => {
    open({ members: members('manager') });
    await userEvent.type(screen.getByPlaceholderText('Ex: Ana Souza'), 'Ana Souza');
    await userEvent.type(screen.getByPlaceholderText('ana@imobiliaria.com.br'), 'ana@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
    expect(screen.getByText('Corretor')).toBeInTheDocument();
  });

  it('administrador como alvo: só a opção de criar o número, sem lista de números', async () => {
    open();
    await userEvent.type(screen.getByPlaceholderText('Ex: Ana Souza'), 'Ana Souza');
    await userEvent.type(screen.getByPlaceholderText('ana@imobiliaria.com.br'), 'ana@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(screen.getByText('Administrador'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(numeroMarcado()).toBeInTheDocument();
    expect(screen.queryByText('Também atende números que já existem')).not.toBeInTheDocument();
  });

  it('sem users.send_access o botão de enviar acesso some; "Só cadastrar" fica', async () => {
    grant('users.send_access');
    open();
    await preencher();
    expect(screen.queryByRole('button', { name: 'Cadastrar e enviar acesso' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Só cadastrar' })).toBeInTheDocument();
  });

  it('"Adicionar várias de uma vez" só existe com onBulk', async () => {
    const onBulk = vi.fn();
    open({ onBulk });
    await userEvent.click(screen.getByText('Adicionar várias de uma vez'));
    expect(onBulk).toHaveBeenCalled();
  });

  async function semCelular() {
    await userEvent.type(screen.getByPlaceholderText('Ex: Ana Souza'), 'Ana Souza');
    await userEvent.type(screen.getByPlaceholderText('ana@imobiliaria.com.br'), 'ana@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(screen.getByText('Corretor'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('sem celular no passo 1: o bloco do número nasce desmarcado e "Só cadastrar" fica livre', async () => {
    open();
    await semCelular();
    expect(numeroMarcado()).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Só cadastrar' })).toBeEnabled();
  });

  it('número marcado e incompleto: o aviso diz o que falta e os botões ficam parados', async () => {
    open();
    await semCelular();
    await userEvent.click(numeroMarcado()!);
    expect(screen.getByText('Falta o telefone do número.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Só cadastrar' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Telefone do número' }), '1194');
    expect(screen.getByText('Telefone incompleto.')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nome do número' }));
    expect(screen.getByText('Falta o nome do número.')).toBeInTheDocument();
  });

  it('falha ao liberar um número existente aparece no resumo', async () => {
    s.add.mockRejectedValueOnce(new Error('x'));
    open();
    await preencher();
    await userEvent.click(screen.getByRole('checkbox', { name: /Comercial/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    expect(await screen.findByText('Não consegui liberar: Comercial')).toBeInTheDocument();
    expect(screen.getByText(/Número Ana Souza criado/)).toBeInTheDocument();
    expect(screen.queryByText(/Link não enviado/)).not.toBeInTheDocument();
  });

  it('sem número, link falhou: resumo com a linha do link e tentar de novo', async () => {
    s.sendAccess.mockResolvedValueOnce({ user: {}, whatsapp: { sent: false, error: 'Número fora do ar' } });
    const props = open();
    await preencher();
    await userEvent.click(numeroMarcado()!);
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar e enviar acesso' }));
    expect(await screen.findByText(/Link não enviado: Número fora do ar/)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/Link de acesso enviado para/)).toBeInTheDocument();
    expect(s.sendAccess).toHaveBeenCalledTimes(2);
    expect(s.createUser).toHaveBeenCalledTimes(1);
  });

  it('cargo próprio com roles.update não aparece para quem não é administrador', async () => {
    const custom = [{ id: 'r7', slug: 'coord', name: 'Coordenação', permissions: ['roles.update'], effective_permissions: ['roles.update'] }] as unknown as CustomRole[];
    open({ members: members('manager'), roles: custom });
    await userEvent.type(screen.getByPlaceholderText('Ex: Ana Souza'), 'Ana Souza');
    await userEvent.type(screen.getByPlaceholderText('ana@imobiliaria.com.br'), 'ana@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByText('Coordenação')).not.toBeInTheDocument();
    expect(screen.getByText('Corretor')).toBeInTheDocument();
  });

  it('"Tentar de novo" do número abre a criação já com nome e telefone', async () => {
    s.createNumber.mockRejectedValueOnce(new Error('x'));
    open();
    await preencher();
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('textbox', { name: 'Nome do número' })).toHaveValue('Ana Souza');
    expect(screen.getByRole('textbox', { name: 'Telefone do número' })).toHaveValue('(11) 94087-1974');
  });
});
