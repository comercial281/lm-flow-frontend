import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({
  catalog: vi.fn(), show: vi.fn(), tenantContext: vi.fn(), update: vi.fn(), resetEvent: vi.fn(), applyToAll: vi.fn(),
}));
vi.mock('@/services/notifications/notificationPolicyService', () => ({ default: svc }));
vi.mock('@/components/notifications/NotificationMatrix', () => ({
  default: (p: { policy: unknown; onToggleChannel: (e: string, c: string, v: boolean) => void; onReset: (e: string) => void }) => (
    <div>
      matriz de avisos
      <output aria-label="política na tela">{JSON.stringify(p.policy)}</output>
      <button onClick={() => p.onToggleChannel('novo_lead', 'push', true)}>ligar aviso</button>
      <button onClick={() => p.onReset('novo_lead')}>restaurar aviso</button>
    </div>
  ),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import NotificationsTab from './NotificationsTab';

const tenants = [
  { id: 'a', slug: 'apto', name: 'Apto Premium', schema: 'tenant_apto' },
  { id: 'b', slug: 'moeda', name: 'Moeda Forte', schema: 'tenant_moeda' },
  { id: 'c', slug: 'domus', name: 'Domus', schema: 'tenant_domus' },
];

describe('Comunicação → Avisos na tela', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.catalog.mockResolvedValue({ tenants });
    svc.show.mockResolvedValue({ tenant: tenants[0], policy: {} });
    svc.tenantContext.mockResolvedValue({ pipelines: [], users: [] });
    svc.applyToAll.mockResolvedValue({ applied: ['moeda', 'domus'], failed: [] });
  });

  it('erro ao carregar não vira tela em branco: mostra o erro e tenta de novo', async () => {
    svc.catalog.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('matriz de avisos')).toBeInTheDocument();
    expect(svc.catalog).toHaveBeenCalledTimes(2);
  });

  it('erro na configuração do cliente aparece no lugar da matriz, com nova tentativa', async () => {
    svc.show.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('matriz de avisos')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('matriz de avisos')).toBeInTheDocument();
  });

  it('sem cliente ativo diz isso, em vez de uma matriz vazia', async () => {
    svc.catalog.mockResolvedValueOnce({ tenants: [] });
    render(<NotificationsTab />);
    expect(await screen.findByText('Nenhum cliente ativo')).toBeInTheDocument();
  });

  it('aplicar a todos confirma dizendo quantos clientes e só então aplica', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await screen.findByText('matriz de avisos');
    await user.click(screen.getByRole('button', { name: /Aplicar a todos os clientes/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Aplicar a configuração de Apto Premium aos 2 clientes?');
    expect(dialogo).toHaveTextContent('A configuração de cada um é substituída.');
    expect(svc.applyToAll).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(svc.applyToAll).toHaveBeenCalledWith('a'));
    expect(toast.success).toHaveBeenCalledWith('Aplicado em 2 clientes');
  });

  it('cancelar a confirmação não aplica', async () => {
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await screen.findByText('matriz de avisos');
    await user.click(screen.getByRole('button', { name: /Aplicar a todos os clientes/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(svc.applyToAll).not.toHaveBeenCalled();
  });

  it('falha das etapas e pessoas avisa e permite tentar de novo', async () => {
    svc.tenantContext.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    expect(await screen.findByText(/Não deu pra carregar as etapas e as pessoas/)).toBeInTheDocument();
    expect(screen.getByText('matriz de avisos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByText(/etapas e as pessoas/)).not.toBeInTheDocument());
    expect(svc.tenantContext).toHaveBeenCalledTimes(2);
  });

  it('troca rápida de cliente descarta a resposta velha e esconde a matriz enquanto carrega', async () => {
    let soltarA!: (v: unknown) => void;
    svc.show.mockImplementationOnce(() => new Promise(r => { soltarA = r; }));
    let soltarB!: (v: unknown) => void;
    svc.show.mockImplementationOnce(() => new Promise(r => { soltarB = r; }));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await waitFor(() => expect(svc.show).toHaveBeenCalledWith('a'));
    await user.selectOptions(screen.getByLabelText('Cliente'), 'b');
    await waitFor(() => expect(svc.show).toHaveBeenCalledWith('b'));
    soltarA({ tenant: tenants[0], policy: {} });
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('matriz de avisos')).not.toBeInTheDocument();
    expect(svc.tenantContext).not.toHaveBeenCalledWith('a');
    soltarB({ tenant: tenants[1], policy: {} });
    expect(await screen.findByText('matriz de avisos')).toBeInTheDocument();
    expect(svc.tenantContext).toHaveBeenCalledWith('b');
  });

  const trocarParaBComPedidoEmVoo = async (clicar: string, servico: 'update' | 'resetEvent') => {
    let soltarA!: (v: unknown) => void;
    svc[servico].mockImplementationOnce(() => new Promise(r => { soltarA = r; }));
    svc.show.mockImplementation(async (id: string) => ({
      tenant: id === 'a' ? tenants[0] : tenants[1],
      policy: { [`dono_${id}`]: { channels: {} } },
    }));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await waitFor(() => expect(screen.getByLabelText('política na tela')).toHaveTextContent('dono_a'));
    await user.click(screen.getByRole('button', { name: clicar }));
    await waitFor(() => expect(svc[servico]).toHaveBeenCalledWith('a', expect.anything()));
    await user.selectOptions(screen.getByLabelText('Cliente'), 'b');
    await waitFor(() => expect(screen.getByLabelText('política na tela')).toHaveTextContent('dono_b'));
    await act(async () => {
      soltarA({ policy: { dono_a: { channels: {} } } });
      await new Promise(r => setTimeout(r, 20));
    });
    expect(screen.getByLabelText('política na tela')).toHaveTextContent('dono_b');
    expect(screen.getByLabelText('política na tela')).not.toHaveTextContent('dono_a');
  };

  it('salvar em A e trocar para B antes da resposta: a matriz de B não muda', async () => {
    await trocarParaBComPedidoEmVoo('ligar aviso', 'update');
  });

  it('restaurar o padrão em A e trocar para B antes da resposta: a matriz de B não muda e sem aviso de sucesso', async () => {
    await trocarParaBComPedidoEmVoo('restaurar aviso', 'resetEvent');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('aplicar a todos rejeitado mostra erro', async () => {
    svc.applyToAll.mockRejectedValueOnce(new Error('x'));
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await screen.findByText('matriz de avisos');
    await user.click(screen.getByRole('button', { name: /Aplicar a todos os clientes/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não consegui aplicar a todos'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falha parcial vira erro e lista os nomes dos clientes que falharam', async () => {
    svc.applyToAll.mockResolvedValueOnce({ applied: ['moeda'], failed: [{ slug: 'domus', error: 'x' }] });
    const user = userEvent.setup();
    render(<NotificationsTab />);
    await screen.findByText('matriz de avisos');
    await user.click(screen.getByRole('button', { name: /Aplicar a todos os clientes/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Aplicado em 1 cliente, mas não em: Domus'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('com um cliente só o botão de aplicar a todos fica desabilitado', async () => {
    svc.catalog.mockResolvedValueOnce({ tenants: [tenants[0]] });
    render(<NotificationsTab />);
    await screen.findByText('matriz de avisos');
    expect(screen.getByRole('button', { name: /Aplicar a todos os clientes/ })).toBeDisabled();
  });
});
