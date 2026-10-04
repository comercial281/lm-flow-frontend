import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet } }));

import Logs from './index';

const item = (extra: Record<string, unknown> = {}) => ({
  id: Math.random().toString(), tenant_schema: 'tenant_a', tenant_name: 'Alfa Imóveis', occurred_at: new Date().toISOString(),
  category: 'contact', action: 'created', level: 'info', title: 'Criou um contato', description: null,
  actor_name: 'Maria', actor_email: 'maria@alfa.com', actor_type: 'User', sensitive: false, ...extra,
});
const pagina = (extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: {
    items: [item(), item({ title: 'Tony entrou no cliente', category: 'admin', sensitive: true, actor_name: 'Tony' })],
    next_before: null, tenants: [{ schema: 'tenant_a', name: 'Alfa Imóveis' }], categories: ['auth', 'admin', 'contact', 'request'], errors: [],
    ...extra,
  } },
});

const montar = (url = '/admin/usuarios/logs') => render(<MemoryRouter initialEntries={[url]}><Logs /></MemoryRouter>);

describe('Logs', () => {
  beforeEach(() => apiGet.mockReset());

  it('lista com cliente, pessoa e selo de sensível', async () => {
    apiGet.mockResolvedValue(pagina());
    montar();
    await waitFor(() => expect(screen.getByText('Tony entrou no cliente')).toBeInTheDocument());
    expect(screen.getAllByText('Sensível')).toHaveLength(1); // só o item sensível
    expect(screen.getAllByText('Alfa Imóveis').length).toBeGreaterThan(0);
    expect(apiGet).toHaveBeenCalledWith('/super/logs', expect.objectContaining({ params: expect.objectContaining({ per_page: 30 }) }));
  });

  it('Só sensíveis e período vão para a URL e para a consulta', async () => {
    apiGet.mockResolvedValue(pagina());
    montar('/admin/usuarios/logs?sensiveis=1&periodo=7d');
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(apiGet.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
      params: expect.objectContaining({ sensitive_only: 'true', period: '7d' }),
    }));
  });

  it('Carregar mais pede os anteriores e junta na lista', async () => {
    apiGet.mockResolvedValueOnce(pagina({ next_before: '2026-10-01T00:00:00.000000Z' }))
          .mockResolvedValueOnce(pagina({ items: [item({ title: 'Mais antigo' })], next_before: null }));
    montar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getByText('Mais antigo')).toBeInTheDocument());
    expect(screen.getByText('Criou um contato')).toBeInTheDocument();
    expect(apiGet.mock.calls.at(-1)?.[1].params.before).toBe('2026-10-01T00:00:00.000000Z');
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('cliente que falhou vira aviso, os outros aparecem', async () => {
    apiGet.mockResolvedValue(pagina({ errors: [{ tenant_name: 'Beta Imóveis', message: 'timeout' }] }));
    montar();
    await waitFor(() => expect(screen.getByText(/Não deu para ler: Beta Imóveis/)).toBeInTheDocument());
    expect(screen.getByText('Criou um contato')).toBeInTheDocument();
  });

  it('erro mostra erro com Tentar de novo, nunca lista vazia', async () => {
    apiGet.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(pagina());
    montar();
    await waitFor(() => expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    await waitFor(() => expect(screen.getByText('Criou um contato')).toBeInTheDocument());
  });

  it('vazio com filtro oferece limpar', async () => {
    apiGet.mockResolvedValue(pagina({ items: [] }));
    montar('/admin/usuarios/logs?q=ninguem');
    await waitFor(() => expect(screen.getByText('Nenhuma ação com esses filtros')).toBeInTheDocument());
  });
});
