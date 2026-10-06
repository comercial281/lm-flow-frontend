import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
vi.mock('../KitBoasVindasBloco', () => ({ default: () => <div>kit</div> }));

import AbaOperacao from './AbaOperacao';

const cliente = { id: 'c1', name: '016', slug: 'x016', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '',
  broker_isolation: true, campaign_only_inbox: false,
  settings: { pipe_entry_sources: ['ads', 'form'], whatsapp_reminder_group_jid: '111@g.us', whatsapp_logs_group_jid: '222@g.us', demo_mode: false } };

const montar = () => render(<MemoryRouter><AbaOperacao cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} /></MemoryRouter>);

describe('Aba Operação', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.get.mockResolvedValue({ data: { data: { whatsapp_groups: [] } } }); });

  it('mudar o que entra no funil reenvia os dois grupos do estado', async () => {
    api.patch.mockResolvedValue({ data: { data: cliente } });
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: 'WhatsApp orgânico' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      pipe_entry_sources: ['ads', 'form', 'organic'], whatsapp_reminder_group_jid: '111@g.us', whatsapp_logs_group_jid: '222@g.us',
    })));
  });

  it('isolamento por corretor não manda grupo nenhum', async () => {
    api.patch.mockResolvedValue({ data: { data: cliente } });
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: 'Isolamento por corretor' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('whatsapp_reminder_group_jid');
  });

  it('ligar demonstração confirma pela caixa da casa (nada de window.confirm)', async () => {
    const nativo = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('switch', { name: 'Modo demonstração' }));
    expect(await screen.findByText(/Ligar o modo demonstração/)).toBeInTheDocument();
    expect(nativo).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('duas fontes ligadas em sequência, antes do 1º PATCH voltar: o 2º leva as duas', async () => {
    let soltar: (v: unknown) => void = () => {};
    api.patch.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    api.patch.mockResolvedValue({ data: { data: cliente } });
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: 'WhatsApp orgânico' }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Manual no CRM' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch.mock.calls[1][1].pipe_entry_sources).toEqual(['ads', 'form', 'organic', 'manual']);
    await act(async () => { soltar({ data: { data: cliente } }); });
  });

  it('falha no PATCH do funil devolve a chave', async () => {
    api.patch.mockRejectedValue(new Error('x'));
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: 'WhatsApp orgânico' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'WhatsApp orgânico' })).not.toBeChecked());
  });

  it('salvar grupo manda as duas chaves', async () => {
    api.get.mockResolvedValue({ data: { data: { whatsapp_groups: [{ jid: '333@g.us', name: 'Novo grupo' }] } } });
    api.patch.mockResolvedValue({ data: { data: cliente } });
    const user = userEvent.setup();
    montar();
    await user.click((await screen.findAllByRole('button', { name: 'Trocar' }))[0]);
    await user.selectOptions(await screen.findByLabelText(/Grupo: Grupo do cliente/), '333@g.us');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      whatsapp_reminder_group_jid: '333@g.us', whatsapp_logs_group_jid: '222@g.us',
    })));
  });

  it('caixa só de campanha não manda grupo', async () => {
    api.patch.mockResolvedValue({ data: { data: cliente } });
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: 'Caixa só de campanha' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1]).toEqual({ name: '016', campaign_only_inbox: true });
  });

  it('demonstração: liga só depois de confirmar, sem mandar grupo', async () => {
    api.patch.mockResolvedValue({ data: { data: cliente } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('switch', { name: 'Modo demonstração' }));
    await user.click(await screen.findByRole('button', { name: 'Ligar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1]).toEqual({ name: '016', demo_mode: true });
  });

  describe('com a demonstração ligada', () => {
    const demo = { ...cliente, settings: { ...cliente.settings, demo_mode: true } };
    const montarDemo = () => render(<MemoryRouter><AbaOperacao cliente={demo as any} aoMudar={vi.fn()} recarregar={vi.fn()} /></MemoryRouter>);

    it('semear só chama o servidor depois de confirmar', async () => {
      api.post.mockResolvedValue({ data: { data: { equipe: 3, imoveis: 4, leads: 5, cards: 6 } } });
      const user = userEvent.setup();
      montarDemo();
      await user.click(await screen.findByRole('button', { name: 'Semear' }));
      expect(api.post).not.toHaveBeenCalled();
      await user.click(await screen.findByRole('button', { name: 'Semear' })); // o da caixa (a página fica oculta atrás dela)
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/pooled_tenants/c1/demo_seed', { dry_run: false }));
    });

    it('recomeçar só chama o servidor depois de digitar o slug', async () => {
      api.post.mockResolvedValue({ data: { data: { semeadura: {} } } });
      const user = userEvent.setup();
      montarDemo();
      await user.click(await screen.findByRole('button', { name: 'Recomeçar demo' }));
      const confirmar = screen.getByRole('button', { name: 'Recomeçar' });
      expect(confirmar).toBeDisabled();
      expect(api.post).not.toHaveBeenCalled();
      await user.type(screen.getByLabelText('Digite x016'), 'x016');
      await user.click(confirmar);
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/pooled_tenants/c1/demo_reset', { confirm_slug: 'x016' }));
    });
  });
});
