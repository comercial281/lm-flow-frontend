// src/pages/SuperAdmin/PooledClients/index.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet, post: apiPost } }));

import PooledClients from './index';

const cliente = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, slug: id, schema_name: `tenant_${id}`, status: 'active', situation: 'ativo', members: 3,
  whatsapp_channels_used: 1, max_whatsapp_channels: 5, login_url: '', ...extra,
});

function responder({ lista = [cliente('bravo', 'Bravo'), cliente('alfa', 'Alfa'), cliente('charlie', 'Charlie')], atencao = true } = {}) {
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/super/pooled_tenants')) return Promise.resolve({ data: { data: lista } });
    if (url === '/super/overview/attention') {
      if (!atencao) return Promise.reject(new Error('lento'));
      return Promise.resolve({ data: { success: true, data: {
        counts: {}, ok_count: 0, generated_at: '', unreadable: [],
        clients: [{ schema: 'tenant_charlie', name: 'Charlie', slug: 'charlie', severity: 'vermelho',
          problems: [{ kind: 'numero_caido', severity: 'vermelho', numbers: [{ inbox_id: 1, name: 'P', phone: null, since: null }] }] }],
      } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

const montar = (url = '/admin/clientes') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/admin/clientes" element={<PooledClients />} />
      <Route path="/admin/clientes/:id" element={<p>página do cliente</p>} />
    </Routes>
  </MemoryRouter>,
);

describe('Lista de clientes', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it('cartões na ordem: problema primeiro, depois nome; selo do problema', async () => {
    responder();
    montar();
    await waitFor(() => expect(screen.getByText('1 número caído')).toBeInTheDocument());
    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes).toEqual(['Charlie', 'Alfa', 'Bravo']);
  });

  it('sem a Atenção, a lista aparece mesmo assim', async () => {
    responder({ atencao: false });
    montar();
    await waitFor(() => expect(screen.getByText('Alfa')).toBeInTheDocument());
    expect(screen.queryByText('1 número caído')).not.toBeInTheDocument();
  });

  it('clicar no cartão abre a página; Entrar não abre', async () => {
    responder();
    apiPost.mockResolvedValue({ data: { data: { url: 'https://alfa.lmflow.com.br/sso' } } });
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    montar();
    const cartao = (await screen.findByText('Alfa')).closest('a')!;
    fireEvent.click(within(cartao).getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://alfa.lmflow.com.br/sso', '_blank'));
    expect(screen.queryByText('página do cliente')).not.toBeInTheDocument();
    fireEvent.click(cartao);
    expect(await screen.findByText('página do cliente')).toBeInTheDocument();
  });

  it('filtro Arquivados pede a lista de arquivados', async () => {
    responder();
    montar('/admin/clientes?filtro=arquivados');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/super/pooled_tenants?archived=true'));
  });

  it('erro na lista aparece como erro, não como vazio', async () => {
    apiGet.mockRejectedValue(new Error('caiu'));
    montar();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/nenhum cliente/i)).not.toBeInTheDocument();
  });
});
