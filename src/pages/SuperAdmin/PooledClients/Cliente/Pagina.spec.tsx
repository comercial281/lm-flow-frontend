import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import Pagina from './Pagina';

const cliente = { id: 'c1', name: '016 Imóveis', slug: 'imoveis016', schema_name: 'tenant_016', status: 'active',
  situation: 'ativo', members: 9, whatsapp_channels_used: 2, max_whatsapp_channels: 5, login_url: '' };

function responder(extra: Record<string, unknown> = {}) {
  api.get.mockImplementation((url: string) => {
    if (url === '/super/pooled_tenants/c1') return Promise.resolve({ data: { data: { ...cliente, ...extra } } });
    if (url === '/super/overview/attention') return Promise.resolve({ data: { success: true, data: { counts: {}, clients: [], ok_count: 0, generated_at: '', unreadable: [] } } });
    if (url === '/super/overview/numbers') return Promise.resolve({ data: { success: true, data: {
      generated_at: '', period: { key: 'mes_atual', bucket: 'day' }, tenants: [], series: [], structure: null, unreadable: [],
      totals: { leads: 12, conversations: 8, users_active: 4, ai_attended: 3, ai_visits: 1, ai_cost_brl: 20 }, previous_totals: {}, clients: [] } } });
    return Promise.reject(new Error(`sem mock ${url}`));
  });
}

const montar = (url = '/admin/clientes/c1') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/admin/clientes/:id" element={<Pagina />} />
      <Route path="/admin/clientes" element={<p>lista</p>} />
    </Routes>
  </MemoryRouter>,
);

describe('Página do cliente', () => {
  beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

  it('topo, abas e Resumo com os números do mês', async () => {
    responder();
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: '016 Imóveis' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/super/overview/numbers', { params: { periodo: 'mes_atual', tenant: 'tenant_016' } }));
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  it('Congelar pede confirmação com o efeito real e só então chama o servidor', async () => {
    responder();
    api.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Congelar' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(await screen.findByText(/As pessoas continuam entrando no CRM/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Congelar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/pooled_tenants/c1/suspend'));
  });

  it('Excluir: 409 vira aviso e volta pra lista', async () => {
    responder();
    api.delete.mockRejectedValue({ response: { status: 409, data: { error: 'paralisado, não apagado' } } });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'imoveis016' } });
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('lista')).toBeInTheDocument();
  });

  it('cliente inexistente', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    montar();
    expect(await screen.findByText('Cliente não encontrado')).toBeInTheDocument();
  });

  // A Task F5 (aba Pessoas) troca por `it` e faz passar.
  it.todo('cliente sem schema: Pessoas mostra erro e a página continua de pé');
});
