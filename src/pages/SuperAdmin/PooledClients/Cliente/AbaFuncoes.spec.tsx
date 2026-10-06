// src/pages/SuperAdmin/PooledClients/Cliente/AbaFuncoes.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByRole('switch', { name: 'Visitas' })).toHaveAttribute('aria-checked', 'false');
    // numa troca só sai UM aviso (o do Desfazer)
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.mock.calls.filter(([m]) => m === 'Bolsão desligada')).toHaveLength(1);
  });

  it('Desligar tudo confirma antes e não grava até confirmar', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await screen.findByRole('switch', { name: 'Bolsão' });
    await user.click(within(screen.getByRole('region', { name: /Funil/ })).getByRole('button', { name: 'Desligar tudo' }));
    expect(await screen.findByText('Os menus deste tema somem para as 9 pessoas de 016 Imóveis.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('Ligar tudo que falha no servidor mostra erro', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: false, bolsao: true, visits: true } } } });
    api.patch.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await screen.findByRole('switch', { name: 'Bolsão' });
    await user.click(within(screen.getByRole('region', { name: /Automações/ })).getByRole('button', { name: 'Ligar tudo' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não deu pra salvar.'));
  });

  it('A falhando enquanto B está pendente não desfaz B', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    let falhaA!: (e: Error) => void;
    api.patch.mockImplementation((_u: string, body: { features: Record<string, boolean> }) =>
      'bolsao' in body.features
        ? new Promise((_r, rej) => { falhaA = rej; })
        : Promise.resolve({ data: { data: { features: { disparos: true, bolsao: true, visits: false } } } }));
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('switch', { name: 'Bolsão' }));
    await user.click(screen.getByRole('switch', { name: 'Visitas' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Visitas' })).toHaveAttribute('aria-checked', 'false'));
    falhaA(new Error('x'));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Bolsão' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('switch', { name: 'Visitas' })).toHaveAttribute('aria-checked', 'false');
  });

  it('desligar o menu inteiro confirma antes, dizendo quantas pessoas', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(await screen.findByRole('switch', { name: 'Disparos' }));
    expect(await screen.findByText('O menu some para as 9 pessoas de 016 Imóveis.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('marca ≠ pacote e filtra só o que difere', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: false, visits: true } } } });
    const c = { ...cliente, package: { id: 'p1', name: 'Completo' }, package_diff: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [] } };
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={c as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByText('≠ pacote')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Só o que difere do pacote' }));
    expect(screen.queryByRole('switch', { name: 'Disparos' })).not.toBeInTheDocument();
  });

  it('recarrega o cliente depois de gravar e depois do Desfazer', async () => {
    api.get.mockResolvedValue({ data: { data: { catalog, features: { disparos: true, bolsao: true, visits: true } } } });
    api.patch.mockImplementation((_u: string, body: { features: Record<string, boolean> }) =>
      Promise.resolve({ data: { data: { features: { disparos: true, bolsao: true, visits: true, ...body.features } } } }));
    const recarregar = vi.fn();
    const user = userEvent.setup();
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={recarregar} />);
    await user.click(await screen.findByRole('switch', { name: 'Bolsão' }));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1));
    const [, opcoes] = toast.mock.calls.find(([msg]) => msg === 'Bolsão desligada')!;
    await opcoes.action.onClick();
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('switch', { name: 'Bolsão' })).toHaveAttribute('aria-checked', 'true');
  });

  it('erro ao carregar aparece como erro', async () => {
    api.get.mockRejectedValue(new Error('schema'));
    render(<AbaFuncoes cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
