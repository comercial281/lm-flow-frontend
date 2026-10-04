import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, post: apiPost } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import FichaDoUsuario from './Ficha';

const pessoa = {
  tenant_schema: 'tenant_a', tenant_name: 'Alfa Imóveis', tenant_id: 't1', user_id: 'u1',
  name: 'Ana Souza', email: 'ana@alfa.com', phone: '11940871974', role: 'Gerente', team: false,
  last_seen_at: new Date().toISOString(), accesses_30d: 3, seconds_30d: 4800, situation: 'ativo',
};
const perfil = (extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: {
    person: pessoa,
    summary: { top_screens: [{ screen: 'Conversas', seconds: 3600 }] },
    entries: [{ started_at: new Date().toISOString(), last_seen_at: null, duration_seconds: 600, ip: '10.0.0.1', device: 'Chrome no Mac', new_device: true }],
    actions: [{ occurred_at: new Date().toISOString(), category: 'lead', action: 'create', title: 'Criou um lead', description: 'Lead João' }],
    ...extra,
  } },
});

const montar = () => render(
  <MemoryRouter initialEntries={['/admin/usuarios/tenant_a/u1']}>
    <Routes><Route path="/admin/usuarios/:tenant/:userId" element={<FichaDoUsuario />} /></Routes>
  </MemoryRouter>,
);

describe('FichaDoUsuario', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it('mostra nome, cliente, aparelho novo e o título de uma ação', async () => {
    apiGet.mockResolvedValue(perfil());
    montar();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Ana Souza' })).toBeInTheDocument());
    expect(screen.getAllByText(/Alfa Imóveis/).length).toBeGreaterThan(0);
    expect(screen.getByText('Aparelho novo')).toBeInTheDocument();
    expect(screen.getByText('Criou um lead')).toBeInTheDocument();
    expect(screen.getAllByText('Conversas')).toHaveLength(2); // cartão + barra
    expect(apiGet).toHaveBeenCalledWith('/super/users/tenant_a/u1');
  });

  it('pessoa sem entradas mostra a mensagem e não quebra', async () => {
    apiGet.mockResolvedValue(perfil({ entries: [], actions: [], summary: { top_screens: [] }, person: { ...pessoa, situation: 'nunca_entrou', last_seen_at: null, accesses_30d: 0, seconds_30d: 0 } }));
    montar();
    await waitFor(() => expect(screen.getByText('Ainda não entrou no LM Flow')).toBeInTheDocument());
    expect(screen.getByText('Sem uso registrado nos últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma ação registrada')).toBeInTheDocument();
  });

  it('404 mostra Usuário não encontrado com link de volta', async () => {
    apiGet.mockRejectedValue({ response: { status: 404 } });
    montar();
    await waitFor(() => expect(screen.getByText('Usuário não encontrado')).toBeInTheDocument());
    expect(screen.getAllByRole('link', { name: /Usuários/ })[0]).toHaveAttribute('href', '/admin/usuarios');
  });

  it('erro 500: Tentar de novo refaz a busca', async () => {
    apiGet.mockRejectedValueOnce({ response: { status: 500 } });
    apiGet.mockResolvedValue(perfil());
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /tentar de novo/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Ana Souza' })).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('resposta atrasada da ficha anterior não sobrescreve a atual', async () => {
    let resolveU1: (v: unknown) => void = () => {};
    const u1 = new Promise((r) => { resolveU1 = r; });
    apiGet.mockImplementation((url: string) => (url.endsWith('/u1') ? u1 : Promise.resolve(perfil({ person: { ...pessoa, user_id: 'u2', name: 'Bia Lima' } }))));
    render(
      <MemoryRouter initialEntries={['/admin/usuarios/tenant_a/u1']}>
        <Link to="/admin/usuarios/tenant_a/u2">ir para u2</Link>
        <Routes><Route path="/admin/usuarios/:tenant/:userId" element={<FichaDoUsuario />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'ir para u2' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Bia Lima' })).toBeInTheDocument());
    await act(async () => { resolveU1(perfil()); await Promise.resolve(); });
    expect(screen.getByRole('heading', { level: 2, name: 'Bia Lima' })).toBeInTheDocument();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('o link de volta mantém os filtros da lista', async () => {
    apiGet.mockResolvedValue(perfil());
    render(
      <MemoryRouter initialEntries={['/admin/usuarios/tenant_a/u1?q=maria']}>
        <Routes><Route path="/admin/usuarios/:tenant/:userId" element={<FichaDoUsuario />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '← Usuários' })).toHaveAttribute('href', '/admin/usuarios?q=maria');
  });
});
