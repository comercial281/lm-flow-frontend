// src/pages/SuperAdmin/PooledClients/Cliente/AbaPessoas.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
vi.mock('@/services/clientInstances/clientInstancesService', () => ({ default: { centralInstances: vi.fn().mockResolvedValue([]) } }));
const copyText = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('@/utils/clipboard', () => ({ copyText }));

import AbaPessoas from './AbaPessoas';

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '' };

describe('Aba Pessoas', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); copyText.mockClear(); });

  it('lista com cargo e não tem campo de senha', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'u1', email: 'ana@x.com', name: 'Ana', role: 'Gerente', last_seen_at: null }] } });
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Gerente')).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });

  it('adicionar pessoa copia o link de acesso', async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { ok: true, access_url: 'https://x.lmflow.com.br/acesso/abc', whatsapp: { skipped: 'sem telefone' } } });
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'nova@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/pooled_tenants/c1/add_member', expect.not.objectContaining({ password: expect.anything() })));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('https://x.lmflow.com.br/acesso/abc'));
  });

  it('remover confirma antes', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'u1', email: 'ana@x.com', name: 'Ana' }] } });
    const user = userEvent.setup();
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Remover ana@x.com' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(await screen.findByText('Ela perde o acesso a este CRM.')).toBeInTheDocument();
  });

  it('erro ao carregar aparece como erro', async () => {
    api.get.mockRejectedValue(new Error('schema'));
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
