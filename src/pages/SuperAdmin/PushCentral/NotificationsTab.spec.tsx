import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({
  catalog: vi.fn(), show: vi.fn(), tenantContext: vi.fn(), update: vi.fn(), resetEvent: vi.fn(), applyToAll: vi.fn(),
}));
vi.mock('@/services/notifications/notificationPolicyService', () => ({ default: svc }));
vi.mock('@/components/notifications/NotificationMatrix', () => ({ default: () => <div>matriz de avisos</div> }));
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
    expect(dialogo).toHaveTextContent('Aplicar este padrão aos 2 clientes?');
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
});
