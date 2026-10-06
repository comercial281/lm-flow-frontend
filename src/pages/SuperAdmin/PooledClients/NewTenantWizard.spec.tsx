import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import NewTenantWizard from './NewTenantWizard';

const pacotes = [{ id: 'p1', name: 'Completo', clients_count: 1, features_on: 9, limits: {} }];

function responder(listaOk = true) {
  api.get.mockImplementation((url: string) => {
    if (url === '/super/packages') return listaOk ? Promise.resolve({ data: { data: pacotes } }) : Promise.reject(new Error('x'));
    return Promise.resolve({ data: { data: { templates: [], whatsapp_groups: [] } } });
  });
}

describe('Novo cliente (assistente)', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); });

  it('com pacote escolhido esconde o máximo de números e o POST leva package_id', async () => {
    responder();
    api.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(<NewTenantWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Ex: Imobiliaria Casa Grande'), 'Casa Grande');
    await user.type(screen.getByPlaceholderText('joao@casagrande.com.br'), 'a@b.com');
    await user.selectOptions(await screen.findByLabelText('Pacote'), 'p1');
    for (let i = 0; i < 2; i++) await user.click(screen.getByRole('button', { name: /Proximo/ }));
    expect(screen.queryByText('Limite de canais de WhatsApp')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Proximo/ }));
    await user.click(screen.getByRole('button', { name: /Criar CRM/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/pooled_tenants', expect.objectContaining({ package_id: 'p1', max_whatsapp_channels: undefined })));
  });

  it('sem pacote mostra o máximo de números e manda package_id vazio', async () => {
    responder();
    const user = userEvent.setup();
    render(<NewTenantWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Ex: Imobiliaria Casa Grande'), 'Casa Grande');
    await user.type(screen.getByPlaceholderText('joao@casagrande.com.br'), 'a@b.com');
    for (let i = 0; i < 2; i++) await user.click(screen.getByRole('button', { name: /Proximo/ }));
    expect(screen.getByText('Limite de canais de WhatsApp')).toBeInTheDocument();
  });

  it('lista de pacotes que falha avisa junto do campo', async () => {
    responder(false);
    render(<NewTenantWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(await screen.findByText('Não deu pra carregar os pacotes; o cliente nasce Personalizado.')).toBeInTheDocument();
  });
});
