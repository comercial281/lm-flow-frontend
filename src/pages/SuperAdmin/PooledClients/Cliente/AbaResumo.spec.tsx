import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import AbaResumo from './AbaResumo';

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '',
  whatsapp_channels_used: 1, max_whatsapp_channels: 5 };

const totals = { leads: 12, conversations: 8, users_active: 4, ai_attended: 3, ai_visits: 1, ai_cost_brl: 20 };
const numeros = (clients: { schema: string }[]) => ({ data: { success: true, data: { totals, clients, tenants: [], series: [], unreadable: [] } } });

function responder({ clients = [{ schema: 'tenant_x' }], pessoas = [] as unknown[], falhaNumeros = false, falhaPessoas = false } = {}) {
  api.get.mockImplementation((url: string) => {
    if (url === '/super/overview/attention') return Promise.resolve({ data: { success: true, data: { counts: {}, clients: [], ok_count: 0, generated_at: '', unreadable: [] } } });
    if (url === '/super/overview/numbers') return falhaNumeros ? Promise.reject(new Error('x')) : Promise.resolve(numeros(clients));
    if (url === '/super/pooled_tenants/c1/members') return falhaPessoas ? Promise.reject(new Error('x')) : Promise.resolve({ data: { data: pessoas } });
    return Promise.reject(new Error(`sem mock ${url}`));
  });
}
const montar = () => render(<MemoryRouter><AbaResumo cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} /></MemoryRouter>);

describe('Aba Resumo', () => {
  beforeEach(() => { api.get.mockReset(); });

  it('mostra os números quando a resposta é deste cliente', async () => {
    responder();
    montar();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.queryByText('Sem números deste cliente no mês.')).not.toBeInTheDocument();
  });

  it('resposta que não é só deste cliente (congelado/arquivado cai nas contas da agência) não mostra números', async () => {
    responder({ clients: [{ schema: 'tenant_a' }, { schema: 'tenant_b' }, { schema: 'tenant_x' }] });
    montar();
    expect(await screen.findByText('Sem números deste cliente no mês.')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('resposta de outro cliente único também é recusada', async () => {
    responder({ clients: [{ schema: 'tenant_outro' }] });
    montar();
    expect(await screen.findByText('Sem números deste cliente no mês.')).toBeInTheDocument();
  });

  it('erro nos números tem Tentar de novo', async () => {
    responder({ falhaNumeros: true });
    montar();
    expect(await screen.findByText('Não deu pra ler os números do mês agora.')).toBeInTheDocument();
    responder();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  it('último acesso é o mais recente entre as pessoas', async () => {
    const agora = Date.now();
    responder({ pessoas: [
      { id: 'u1', email: 'ana@x.com', name: 'Ana', last_seen_at: new Date(agora - 3 * 86_400_000).toISOString() },
      { id: 'u2', email: 'beto@x.com', name: 'Beto', last_seen_at: new Date(agora - 2 * 3_600_000).toISOString() },
      { id: 'u3', email: 'cris@x.com', last_seen_at: null },
      { id: 'u4', email: 'suporte@lealmidia.com.br', name: 'Suporte LM', last_seen_at: new Date(agora - 60_000).toISOString() },
    ] });
    montar();
    expect(await screen.findByText('Último acesso: há 2 h (Beto)')).toBeInTheDocument();
  });

  it('ninguém entrou ainda', async () => {
    responder({ pessoas: [{ id: 'u1', email: 'ana@x.com', last_seen_at: null }] });
    montar();
    expect(await screen.findByText('Ninguém entrou ainda')).toBeInTheDocument();
  });

  it('erro ao ler as pessoas tem Tentar de novo próprio', async () => {
    responder({ falhaPessoas: true });
    montar();
    expect(await screen.findByText('Não deu pra ver o último acesso.')).toBeInTheDocument();
    responder({ pessoas: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('Ninguém entrou ainda')).toBeInTheDocument());
  });
});
