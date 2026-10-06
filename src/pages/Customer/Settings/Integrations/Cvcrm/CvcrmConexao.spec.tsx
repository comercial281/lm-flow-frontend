import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CvcrmConexao from './CvcrmConexao';

const servico = vi.hoisted(() => ({ get: vi.fn(), connect: vi.fn(), disconnect: vi.fn() }));
vi.mock('@/services/cvcrm/cvcrmService', () => ({ cvcrmService: servico, default: servico }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const desconectado = { connected: false, subdomain: null, email: null, token_state: 'none', connected_at: null, agents_using: 0 };
const conectado = { connected: true, subdomain: 'habras', email: 'gestor@habras.com.br', token_state: 'ready', connected_at: '2026-10-06T17:00:00Z', agents_using: 2 };

const digitar = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe('Integrações → CVCRM', () => {
  beforeEach(() => vi.clearAllMocks());

  it('conecta com endereço, e-mail e token e mostra quantos empreendimentos achou', async () => {
    servico.get.mockResolvedValue(desconectado);
    servico.connect.mockResolvedValue({ ...conectado, empreendimentos_count: 12 });
    render(<CvcrmConexao />);

    await screen.findByLabelText('Endereço do seu CVCRM');
    const botao = screen.getByRole('button', { name: /Conectar/ });
    expect(botao).toBeDisabled();
    digitar('Endereço do seu CVCRM', 'habras.cvcrm.com.br');
    digitar('E-mail do usuário', 'gestor@habras.com.br');
    digitar('Token', 'tok-123');
    fireEvent.click(botao);

    expect(await screen.findByRole('status')).toHaveTextContent('Conectado · 12 empreendimentos encontrados');
    expect(servico.connect).toHaveBeenCalledWith({ subdomain: 'habras.cvcrm.com.br', email: 'gestor@habras.com.br', token: 'tok-123' });
    expect(screen.getByText(/Usada por 2 IAs/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Token')).not.toBeInTheDocument();
  });

  it('recusa do CVCRM aparece com a frase do servidor', async () => {
    servico.get.mockResolvedValue(desconectado);
    servico.connect.mockRejectedValue({ response: { data: { error: { message: 'O CVCRM recusou o e-mail ou o token.' } } } });
    render(<CvcrmConexao />);

    await screen.findByLabelText('Endereço do seu CVCRM');
    digitar('Endereço do seu CVCRM', 'habras');
    digitar('E-mail do usuário', 'gestor@habras.com.br');
    digitar('Token', 'errado');
    fireEvent.click(screen.getByRole('button', { name: /Conectar/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('O CVCRM recusou o e-mail ou o token.');
  });

  it('conectado: mostra endereço e e-mail, nunca o token, e troca o token reabrindo os campos', async () => {
    servico.get.mockResolvedValue(conectado);
    render(<CvcrmConexao />);

    expect(await screen.findByText('habras.cvcrm.com.br')).toBeInTheDocument();
    expect(screen.queryByLabelText('Token')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trocar token' }));
    expect(screen.getByLabelText('Endereço do seu CVCRM')).toHaveValue('habras.cvcrm.com.br');
    expect(screen.getByLabelText('E-mail do usuário')).toHaveValue('gestor@habras.com.br');
    expect(screen.getByLabelText('Token')).toHaveValue('');
  });

  it('desconectar pede confirmação', async () => {
    servico.get.mockResolvedValue(conectado);
    servico.disconnect.mockResolvedValue({ ...desconectado, subdomain: 'habras', email: 'gestor@habras.com.br' });
    render(<CvcrmConexao />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    expect(servico.disconnect).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desconectar' }));

    await waitFor(() => expect(servico.disconnect).toHaveBeenCalled());
    expect(await screen.findByLabelText('Endereço do seu CVCRM')).toHaveValue('habras.cvcrm.com.br');
  });

  it('trocar pra outro CVCRM com IAs usando avisa pra conferir as IAs', async () => {
    servico.get.mockResolvedValue(conectado);
    render(<CvcrmConexao />);

    fireEvent.click(await screen.findByRole('button', { name: 'Trocar token' }));
    expect(screen.queryByText(/Esse é outro CVCRM/)).not.toBeInTheDocument();
    digitar('Endereço do seu CVCRM', 'https://outra.cvcrm.com.br/gestor');
    expect(screen.getByText(/Esse é outro CVCRM/)).toBeInTheDocument();
  });
});
