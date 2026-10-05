import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
});
