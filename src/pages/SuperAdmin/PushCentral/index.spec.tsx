// src/pages/SuperAdmin/PushCentral/index.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({
  list: vi.fn(), logs: vi.fn(), toggle: vi.fn(), remove: vi.fn(), create: vi.fn(), update: vi.fn(),
  sendNow: vi.fn(), audienceCount: vi.fn(),
}));
vi.mock('@/services/push/pushCentralService', () => ({ default: svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import PushCentral from './index';

const regra = {
  id: 'r1', name: 'Lead de campanha', trigger: 'lead.campanha', trigger_label: 'Lead de campanha',
  triggers: ['lead.campanha'], triggers_labels: ['Lead de campanha'], tenant_scope: 'all', tenant_slugs: [],
  audience: 'admin', audience_label: 'Para mim (Leal Mídia)', title: 'Lead novo', body: 'Chegou', url: null,
  is_active: true, superseded: false, superseded_by: [], created_at: '', updated_at: '',
};
const indice = {
  rules: [regra],
  options: {
    triggers: [{ value: 'lead.campanha', label: 'Lead de campanha' }],
    audiences: [{ value: 'admin', label: 'Para mim (Leal Mídia)' }, { value: 'client', label: 'Para os usuários do cliente' }],
    tenant_scopes: [{ value: 'all', label: 'Todos os clientes' }],
    tenants: [{ slug: 'moeda', name: 'Moeda Forte' }],
    variables: [],
  },
  push_ready: true,
};
const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

describe('Comunicação → Push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.list.mockImplementation(() => ok(indice));
    svc.logs.mockImplementation(() => ok([]));
    svc.toggle.mockImplementation(() => ok({ ...regra, is_active: false }));
    svc.audienceCount.mockImplementation(({ audience }: { audience: string }) =>
      ok(audience === 'client' ? { people: 12, devices: 17 } : { people: 1, devices: 2 }));
    svc.sendNow.mockImplementation(() => ok({ status: 'sent', devices: 2 }));
  });

  it('Regras, Disparo manual e Histórico ficam na mesma página, sem abas', async () => {
    render(<PushCentral />);
    expect(await screen.findByRole('heading', { name: 'Regras' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Disparo manual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
    expect(await screen.findByText('Nada disparado ainda')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('erro nas regras e no histórico aparece como erro, com nova tentativa', async () => {
    svc.list.mockRejectedValueOnce(new Error('rede'));
    svc.logs.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<PushCentral />);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    await user.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0]);
    expect(await screen.findByRole('switch', { name: 'Regra Lead de campanha' })).toBeInTheDocument();
    expect(svc.list).toHaveBeenCalledTimes(2);
  });

  it('liga/desliga da regra é a chave da casa', async () => {
    const user = userEvent.setup();
    render(<PushCentral />);
    await user.click(await screen.findByRole('switch', { name: 'Regra Lead de campanha' }));
    await waitFor(() => expect(svc.toggle).toHaveBeenCalledWith('r1'));
  });

  it('disparo manual confirma com o público e a quantidade antes de enviar', async () => {
    const user = userEvent.setup();
    render(<PushCentral />);
    expect(await screen.findByText('Vai para você (2 aparelhos).')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Sistema volta às 14h' } });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Enviar para você (2 aparelhos)?');
    expect(svc.sendNow).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(svc.sendNow).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'admin', title: 'Aviso da Leal Mídia', body: 'Sistema volta às 14h' }),
    ));
  });

  it('para um cliente diz quantas pessoas e aparelhos e de qual cliente', async () => {
    render(<PushCentral />);
    await screen.findByText('Vai para você (2 aparelhos).');
    fireEvent.change(screen.getByLabelText('Para quem'), { target: { value: 'client' } });
    fireEvent.change(await screen.findByLabelText('Cliente'), { target: { value: 'moeda' } });
    expect(await screen.findByText('Vai para 12 pessoas (17 aparelhos) de Moeda Forte.')).toBeInTheDocument();
    expect(svc.audienceCount).toHaveBeenLastCalledWith({ audience: 'client', tenant_slug: 'moeda' });
  });

  it('zero aparelhos trava o Enviar e diz o motivo', async () => {
    svc.audienceCount.mockImplementation(() => ok({ people: 0, devices: 0 }));
    render(<PushCentral />);
    expect(await screen.findByText(/Ninguém neste público está com o push ligado/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Oi' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('cliente que não serve (422) vira motivo na tela e trava o Enviar', async () => {
    svc.audienceCount.mockImplementation(({ audience }: { audience: string }) =>
      audience === 'client'
        ? Promise.reject({ response: { status: 422, data: { error: 'Este cliente ainda não tem o CRM montado' } } })
        : ok({ people: 1, devices: 2 }));
    render(<PushCentral />);
    await screen.findByText('Vai para você (2 aparelhos).');
    fireEvent.change(screen.getByLabelText('Para quem'), { target: { value: 'client' } });
    fireEvent.change(await screen.findByLabelText('Cliente'), { target: { value: 'moeda' } });
    expect(await screen.findByText('Este cliente ainda não tem o CRM montado')).toBeInTheDocument();
    expect(screen.queryByText('Não consegui contar os aparelhos.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Oi' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('falha ao contar (não 422) mostra erro com nova tentativa e trava o Enviar', async () => {
    svc.audienceCount.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<PushCentral />);
    expect(await screen.findByText('Não consegui contar os aparelhos.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Oi' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Vai para você (2 aparelhos).')).toBeInTheDocument();
  });
});
