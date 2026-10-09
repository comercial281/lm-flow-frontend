import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateNumberDialog from './CreateNumberDialog';
import type { TeamAccessMember } from '@/types/teamAccess';

const s = vi.hoisted(() => ({
  create: vi.fn(),
  sendAccess: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => s.navigate }));
vi.mock('@/services/users', () => ({
  usersService: { createWhatsappNumber: s.create, sendAccess: s.sendAccess },
}));

const member = (over: Partial<TeamAccessMember> = {}) => ({
  id: 'u1', name: 'Ana Souza', whatsapp_number: '5511940871974', ...over,
}) as unknown as TeamAccessMember;

const abrir = (m = member()) => {
  const props = { member: m, open: true, onClose: vi.fn(), onDone: vi.fn() };
  render(<CreateNumberDialog {...props} />);
  return props;
};

const criar = () => screen.getByRole('button', { name: 'Criar número' });
const serverError = (code: string, message: string) => ({ response: { data: { success: false, error: { code, message } } } });

describe('CreateNumberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.create.mockResolvedValue({ inbox_id: '77', name: 'Ana Souza', phone: '5511940871974', connection: null });
    s.sendAccess.mockResolvedValue({ user: {}, whatsapp: { sent: true } });
  });

  it('vem preenchida com o nome e o celular da pessoa, primeiro acesso marcado', () => {
    abrir();
    expect(screen.getByRole('textbox', { name: 'Nome do número' })).toHaveValue('Ana Souza');
    expect(screen.getByRole('textbox', { name: 'Telefone do número' })).toHaveValue('(11) 94087-1974');
    expect(screen.getByRole('radio', { name: 'Ana Souza, no primeiro acesso' })).toBeChecked();
    expect(screen.queryByText(/Seu plano tem/)).not.toBeInTheDocument();
    expect(criar()).toBeEnabled();
  });

  it('sem celular: pede o celular, já marcado como o mesmo do número, e só libera com telefone válido', async () => {
    abrir(member({ whatsapp_number: null }));
    expect(screen.getByText(/precisa de um celular/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'É o mesmo telefone do número' })).toBeChecked();
    expect(criar()).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Telefone do número' }), '11940871974');
    expect(criar()).toBeEnabled();
    // desmarcando, o celular passa a ser outro campo, vazio
    await userEvent.click(screen.getByRole('checkbox', { name: 'É o mesmo telefone do número' }));
    expect(criar()).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Celular de Ana Souza' }), '11999998888');
    expect(criar()).toBeEnabled();
  });

  it('primeiro acesso: cria o número, manda o link e mostra o resumo', async () => {
    const props = abrir();
    await userEvent.click(criar());
    await waitFor(() => expect(s.create).toHaveBeenCalledWith('u1', { name: 'Ana Souza', phone_number: '5511940871974' }));
    expect(s.sendAccess).toHaveBeenCalledWith('u1', { whatsapp_number: '11940871974' });
    expect(s.create.mock.invocationCallOrder[0]).toBeLessThan(s.sendAccess.mock.invocationCallOrder[0]);
    expect(await screen.findByText(/Link de acesso enviado para/)).toBeInTheDocument();
    expect(screen.getByText(/Esperando Ana Souza conectar o número/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ana Souza está aqui: abrir QR code' }));
    expect(s.navigate).toHaveBeenCalledWith('/channels/77/settings?tab=configuration&connect=1');
    expect(props.onDone).toHaveBeenCalled();
  });

  it('Concluir fecha e avisa para recarregar a lista', async () => {
    const props = abrir();
    await userEvent.click(criar());
    await userEvent.click(await screen.findByRole('button', { name: 'Concluir' }));
    expect(props.onDone).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('"Agora, nesta tela": cria e vai direto ao QR code, sem mandar link', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Agora, nesta tela' }));
    await userEvent.click(criar());
    await waitFor(() => expect(s.navigate).toHaveBeenCalledWith('/channels/77/settings?tab=configuration&connect=1'));
    expect(s.sendAccess).not.toHaveBeenCalled();
    expect(props.onDone).toHaveBeenCalled();
  });

  it('"Agora" não exige celular da pessoa', async () => {
    abrir(member({ whatsapp_number: null }));
    await userEvent.click(screen.getByRole('radio', { name: 'Agora, nesta tela' }));
    expect(screen.queryByText(/precisa de um celular/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Telefone do número' }), '11940871974');
    expect(criar()).toBeEnabled();
  });

  it.each([
    ['limit', 'Seu plano permite 3 números de WhatsApp e todos estão em uso. Fale com a Leal Mídia para liberar mais.'],
    ['phone_taken', 'Esse telefone já é do número Comercial.'],
  ])('recusa %s do servidor aparece como veio, sem criar nada além', async (code, message) => {
    s.create.mockRejectedValue(serverError(code, message));
    abrir();
    await userEvent.click(criar());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(code)).not.toBeInTheDocument();
    expect(s.sendAccess).not.toHaveBeenCalled();
    expect(s.navigate).not.toHaveBeenCalled();
  });

  it('link falhou: o número fica criado e dá para tentar só o link de novo', async () => {
    s.sendAccess.mockResolvedValueOnce({ user: {}, whatsapp: { sent: false, error: 'Número fora do ar' } });
    abrir();
    await userEvent.click(criar());
    expect(await screen.findByText(/Link não enviado: Número fora do ar/)).toBeInTheDocument();
    expect(screen.getByText(/Número Ana Souza criado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText(/Link de acesso enviado para/)).toBeInTheDocument());
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(s.sendAccess).toHaveBeenCalledTimes(2);
  });

  it('o envio do link estourar (rede/403) também mantém o número', async () => {
    s.sendAccess.mockRejectedValueOnce(serverError('x', 'Seu cargo só mexe no cadastro de corretores.'));
    abrir();
    await userEvent.click(criar());
    expect(await screen.findByText(/Link não enviado: Seu cargo só mexe no cadastro de corretores\./)).toBeInTheDocument();
  });
});
