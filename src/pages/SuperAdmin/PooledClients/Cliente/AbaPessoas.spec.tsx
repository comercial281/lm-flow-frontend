// src/pages/SuperAdmin/PooledClients/Cliente/AbaPessoas.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
vi.mock('@/services/clientInstances/clientInstancesService', () => ({ default: { centralInstances: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
const aviso = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: aviso }));
const copyText = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('@/utils/clipboard', () => ({ copyText }));

import clientInstancesService from '@/services/clientInstances/clientInstancesService';
import AbaPessoas from './AbaPessoas';
const centralInstances = clientInstancesService.centralInstances as ReturnType<typeof vi.fn>;

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '' };

describe('Aba Pessoas', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); copyText.mockReset(); copyText.mockResolvedValue(true); aviso.error.mockReset(); aviso.success.mockReset(); });

  it('lista com cargo e não tem campo de senha', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'u1', email: 'ana@x.com', name: 'Ana', role: 'Gerente', last_seen_at: null }] } });
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    await waitFor(() => expect(centralInstances).toHaveBeenCalled());
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

  it('área de transferência bloqueada: mostra o link e não diz "copiado"', async () => {
    copyText.mockResolvedValue(false);
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { ok: true, access_url: 'https://x.lmflow.com.br/acesso/abc' } });
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'nova@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }));
    expect(await screen.findByDisplayValue('https://x.lmflow.com.br/acesso/abc')).toBeInTheDocument();
    expect(aviso.success).not.toHaveBeenCalledWith(expect.stringMatching(/copiado/));
    expect(aviso.error).toHaveBeenCalled();
  });

  it('copiar link com a área bloqueada também mostra o link', async () => {
    copyText.mockResolvedValue(false);
    api.get.mockResolvedValue({ data: { data: [{ id: 'u1', email: 'ana@x.com', name: 'Ana' }] } });
    api.post.mockResolvedValue({ data: { data: { url: 'https://x.lmflow.com.br/acesso/zzz' } } });
    const user = userEvent.setup();
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Copiar link de ana@x.com' }));
    expect(await screen.findByDisplayValue('https://x.lmflow.com.br/acesso/zzz')).toBeInTheDocument();
    expect(aviso.success).not.toHaveBeenCalled();
  });

  it('pediu envio no WhatsApp e não saiu: avisa o motivo', async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { ok: true, access_url: 'https://x/a', whatsapp: { sent: false, skipped: 'instância desconectada' } } });
    render(<AbaPessoas cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'nova@x.com' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }));
    await waitFor(() => expect(aviso.error).toHaveBeenCalledWith('Não enviou: instância desconectada'));
  });
});
