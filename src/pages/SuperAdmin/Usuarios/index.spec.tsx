import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, post: apiPost } }));
vi.mock('sonner', () => ({ toast }));

import Usuarios from './index';

const ontem = new Date(Date.now() - 10 * 86_400_000).toISOString();
const ana = {
  tenant_schema: 'tenant_a', tenant_name: 'Alfa Imóveis', tenant_id: 't1', user_id: 'u1',
  name: 'Ana Souza', email: 'ana@alfa.com', phone: '11940871974', role: 'Gerente', team: false,
  last_seen_at: ontem, accesses_30d: 3, seconds_30d: 4800, situation: 'sumido',
};
const principal = {
  ...ana, tenant_schema: 'public', tenant_name: 'Leal Mídia', tenant_id: null, user_id: 'u9',
  name: 'Paulo Principal', email: 'paulo@lm.com', role: 'Administrador',
};

const pagina = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: {
    items, meta: { total: items.length, page: 1, per_page: 20 },
    tenants: [{ schema: 'tenant_a', name: 'Alfa Imóveis' }], roles: ['Gerente'], errors: [], ...extra,
  } },
});

const montar = () => render(<MemoryRouter><Usuarios /></MemoryRouter>);

describe('Usuarios', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); toast.success.mockReset(); toast.error.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('lista nome, cliente, cargo e situação, e esconde as ações do principal', async () => {
    apiGet.mockResolvedValue(pagina([ana, principal]));
    montar();
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    expect(screen.getByText('ana@alfa.com')).toBeInTheDocument();
    expect(screen.getAllByText('Alfa Imóveis').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gerente').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', '/admin/usuarios/tenant_a/u1');
    expect(screen.getByText('Leal Mídia (principal)')).toBeInTheDocument();
    const linhaPrincipal = screen.getByText('Paulo Principal').closest('tr') as HTMLElement;
    expect(within(linhaPrincipal).queryByRole('button', { name: /link/i })).not.toBeInTheDocument();
    const linhaAna = screen.getByText('Ana Souza').closest('tr') as HTMLElement;
    expect(within(linhaAna).getByText('Sumido há 7+ dias')).toBeInTheDocument();
    expect(within(linhaAna).getByRole('button', { name: /copiar link/i })).toBeInTheDocument();
  });

  it('a busca só dispara depois de 300 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    apiGet.mockResolvedValue(pagina([ana]));
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(apiGet).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '(11) 94087' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(apiGet).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(apiGet).toHaveBeenLastCalledWith('/super/users', { params: { per_page: 20, q: '(11) 94087' } });
  });

  it('cliente que falhou vira aviso e a tabela mostra os outros', async () => {
    apiGet.mockResolvedValue(pagina([ana], { errors: [{ tenant_name: 'Quebrado', message: 'timeout' }] }));
    montar();
    await waitFor(() => expect(screen.getByText(/Não deu para ler: Quebrado/)).toBeInTheDocument());
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('erro geral mostra Tentar de novo e não "Nenhum usuário"', async () => {
    apiGet.mockRejectedValue(new Error('x'));
    montar();
    await waitFor(() => expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument());
    expect(screen.queryByText('Nenhum usuário')).not.toBeInTheDocument();
  });

  it('Enviar link só chama o POST depois de confirmar', async () => {
    apiGet.mockResolvedValue(pagina([ana]));
    apiPost.mockResolvedValue({ data: { whatsapp: { sent: true, instance: 'LM01' } } });
    montar();
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));
    await waitFor(() => expect(screen.getByText('Enviar link de acesso?')).toBeInTheDocument());
    expect(screen.getByText(/Vai pelo WhatsApp de Ana Souza/)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/super/pooled_tenants/t1/send_access_link', { user_id: 'u1' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('Enviar link cancelado não faz POST', async () => {
    apiGet.mockResolvedValue(pagina([ana]));
    montar();
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));
    await waitFor(() => expect(screen.getByText('Enviar link de acesso?')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await act(async () => { await Promise.resolve(); });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('mudar o filtro esconde as linhas antigas e descarta a resposta antiga atrasada', async () => {
    let soltaVelha: (v: unknown) => void = () => {};
    let soltaNova: (v: unknown) => void = () => {};
    apiGet.mockImplementationOnce(() => Promise.resolve(pagina([ana])));
    montar();
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    apiGet.mockImplementationOnce(() => new Promise((r) => { soltaVelha = r; }));
    fireEvent.click(screen.getByLabelText('Incluir equipe Leal Mídia'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    apiGet.mockImplementationOnce(() => new Promise((r) => { soltaNova = r; }));
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'ativo' } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(3));
    await act(async () => { soltaNova(pagina([{ ...ana, user_id: 'u2', name: 'Bia Nova', situation: 'ativo' }])); });
    await waitFor(() => expect(screen.getByText('Bia Nova')).toBeInTheDocument());
    await act(async () => { soltaVelha(pagina([{ ...ana, user_id: 'u3', name: 'Velha Resposta' }])); });
    expect(screen.queryByText('Velha Resposta')).not.toBeInTheDocument();
    expect(screen.getByText('Bia Nova')).toBeInTheDocument();
  });
});
