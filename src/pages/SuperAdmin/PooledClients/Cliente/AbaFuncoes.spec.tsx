// src/pages/SuperAdmin/PooledClients/Cliente/AbaFuncoes.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import AbaFuncoes from './AbaFuncoes';

const catalog = [
  { key: 'disparos', label: 'Disparos', group: 'disparos', theme: 'automacoes', theme_label: 'Automações' },
  { key: 'bolsao', label: 'Bolsão', theme: 'funil', theme_label: 'Funil' },
  { key: 'visits', label: 'Visitas', theme: 'funil', theme_label: 'Funil' },
];
const cliente = { id: 'c1', name: '016 Imóveis', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 9, login_url: '' };

describe('Aba Funções', () => {
  beforeEach(() => { api.get.mockReset(); api.patch.mockReset(); toast.mockReset(); });

  it('grava na hora e Desfazer religa só aquela função', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    api.patch.mockImplementation((_u: string, body: { features: Record<string, boolean> }) =>
      Promise.resolve({ data: { data: { features: { disparos: true, bolsao: true, visits: true, ...body.features } } } }));
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('switch', { name: 'Bolsão' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1/update_features', { features: { bolsao: false } }));
    await user.click(screen.getByRole('switch', { name: 'Visitas' }));
    const [, opcoes] = toast.mock.calls.find(([msg]) => msg === 'Bolsão desligada')!;
    await opcoes.action.onClick();
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/super/pooled_tenants/c1/update_features', { features: { bolsao: true } }));
  });

  it('desligar o menu inteiro confirma antes, dizendo quantas pessoas', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('switch', { name: 'Disparos' }));
    expect(await screen.findByText('O menu some para as 9 pessoas de 016 Imóveis.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('erro ao carregar aparece como erro', async () => {
    api.get.mockRejectedValue(new Error('schema'));
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
