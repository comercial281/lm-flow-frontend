// src/pages/SuperAdmin/ChavesMcp/ChavesMcp.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ listar: vi.fn(), gerar: vi.fn(), revogar: vi.fn(), clientes: vi.fn(), mudarPerfil: vi.fn() }));
vi.mock('@/services/superAdmin/mcpKeysService', () => ({ mcpKeysService: svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import ChavesMcp from './index';

const ativa = { id: 'k1', name: 'Claude do Tony', key_prefix: 'AbC123', created_by_email: 'tony@x.com',
  created_at: '2026-10-11T10:00:00Z', last_used_at: null, revoked_at: null, active: true, profile: 'operator', expires_at: '2099-01-01T00:00:00Z',
  expired: false, tenant_schemas: null, allowed_ips: null, url_allowed: false };
const clientes = [{ schema_name: 'tenant_a', slug: 'a', name: 'Cliente Alfa' }, { schema_name: 'tenant_b', slug: 'b', name: 'Cliente Beta' }];

const abrir = () => render(<MemoryRouter><ChavesMcp /></MemoryRouter>);

describe('Chaves do MCP', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.listar.mockResolvedValue([ativa]); svc.clientes.mockResolvedValue(clientes); });

  it('lista com o começo da chave e a situação', async () => {
    abrir();
    expect(await screen.findByText('Claude do Tony')).toBeInTheDocument();
    expect(screen.getByText(/AbC123/)).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Nunca usada')).toBeInTheDocument();
  });

  it('gera (operador) e mostra só o cabeçalho, sem endereço com a chave', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k2', name: 'Celular', key: 'lmf_segredo', url: 'https://api.x/mcp',
      header: 'Authorization: Bearer lmf_segredo' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Celular');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(svc.gerar).toHaveBeenCalledWith({ name: 'Celular', profile: 'operator', url_allowed: false });
    expect(await screen.findByDisplayValue('Authorization: Bearer lmf_segredo')).toBeInTheDocument();
    expect(screen.getByText(/não aparece de novo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Endereço com a chave/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Já guardei' }));
    await waitFor(() => expect(screen.queryByDisplayValue('Authorization: Bearer lmf_segredo')).not.toBeInTheDocument());
    expect(await screen.findByText('Celular')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('lmf_segredo');
  });

  it.each([
    ['sem a chave', { key: '', header: 'Authorization: Bearer lmf_x' }, 'operator'],
    ['sem o cabeçalho', { key: 'lmf_x', header: '' }, 'operator'],
    ['com perfil diferente do pedido', { key: 'lmf_x', header: 'Authorization: Bearer lmf_x' }, 'owner'],
  ])('resposta da criação %s mostra erro e não abre a janela da chave', async (_nome, resposta, perfil) => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k9', name: 'Celular', url: 'https://api.x/mcp', profile: perfil, ...resposta });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Celular');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText('Guarde a chave agora')).not.toBeInTheDocument();
    expect(screen.queryByText('Celular')).not.toBeInTheDocument();
  });

  it('a janela da chave criada é mascarada na gravação de sessão', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k2', name: 'Celular', key: 'lmf_segredo', url: 'https://api.x/mcp',
      header: 'Authorization: Bearer lmf_segredo' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Celular');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    const campo = await screen.findByDisplayValue('Authorization: Bearer lmf_segredo');
    expect(campo.closest('[data-clarity-mask="true"]')).not.toBeNull();
  });

  it('"chave no endereço" mostra também o endereço com a chave', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k3', name: 'Navegador', url_allowed: true, key: 'lmf_segredo',
      url: 'https://api.x/mcp/lmf_segredo', header: 'Authorization: Bearer lmf_segredo' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Navegador');
    await userEvent.click(screen.getByRole('checkbox', { name: /Chave no endereço/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(svc.gerar).toHaveBeenCalledWith({ name: 'Navegador', profile: 'operator', url_allowed: true });
    expect(await screen.findByDisplayValue('https://api.x/mcp/lmf_segredo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Authorization: Bearer lmf_segredo')).toBeInTheDocument();
  });

  it('agente exige clientes e IP, e não oferece "chave no endereço"', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k4', name: 'Robô', profile: 'agent', tenant_schemas: ['tenant_a'],
      allowed_ips: ['203.0.113.10'], key: 'lmf_x', url: 'https://api.x/mcp', header: 'Authorization: Bearer lmf_x' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Robô');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Perfil' }), 'agent');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const gerar = screen.getByRole('button', { name: 'Gerar' });
    expect(gerar).toBeDisabled();
    await userEvent.click(await screen.findByRole('button', { name: 'Cliente Alfa' }));
    expect(gerar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/IP de origem/), '203.0.113.10');
    expect(gerar).toBeEnabled();
    await userEvent.click(gerar);
    expect(svc.gerar).toHaveBeenCalledWith({ name: 'Robô', profile: 'agent', tenant_schemas: ['tenant_a'],
      allowed_ips: ['203.0.113.10'], url_allowed: false });
  });

  it('perfil Operador não leva clientes nem IP preenchidos antes como Agente', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k6', name: 'Volta', key: 'lmf_z', url: 'https://api.x/mcp', header: 'Authorization: Bearer lmf_z' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText(/Nome da chave/), 'Volta');
    const perfil = screen.getByRole('combobox', { name: 'Perfil' });
    await userEvent.selectOptions(perfil, 'agent');
    await userEvent.click(await screen.findByRole('button', { name: 'Cliente Alfa' }));
    await userEvent.type(screen.getByLabelText(/IP de origem/), '203.0.113.10');
    await userEvent.selectOptions(perfil, 'operator');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(svc.gerar).toHaveBeenCalledWith({ name: 'Volta', profile: 'operator', url_allowed: false });
  });

  it('avisa quando a lista de clientes não carrega', async () => {
    svc.clientes.mockRejectedValue(new Error('x'));
    abrir();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('lista mostra perfil, vencimento, clientes (todos ou nomes), IP e endereço', async () => {
    svc.listar.mockResolvedValue([
      ativa,
      { ...ativa, id: 'k5', name: 'Robô', profile: 'agent', tenant_schemas: ['tenant_a', 'tenant_b'],
        allowed_ips: ['203.0.113.10'], expired: true, expires_at: '2020-01-01T00:00:00Z' },
    ]);
    abrir();
    await screen.findByText('Robô');
    expect(screen.getByText('Perfil: Operador')).toBeInTheDocument();
    expect(screen.getByText('Perfil: Agente')).toBeInTheDocument();
    expect(screen.getByText('Clientes: todos')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Clientes: Cliente Alfa, Cliente Beta')).toBeInTheDocument());
    expect(screen.getByText('IP: livre')).toBeInTheDocument();
    expect(screen.getByText('IP: 203.0.113.10')).toBeInTheDocument();
    expect(screen.getByText(/^Vencida/)).toHaveClass('text-red-600');
    expect(screen.getByText(/^Vence /)).toBeInTheDocument();
    expect(screen.getAllByText('No endereço: não')).toHaveLength(2);
    expect(screen.queryByLabelText('Perfil: Robô')).not.toBeInTheDocument();
  });

  it('revoga com confirmação', async () => {
    svc.revogar.mockResolvedValue({ ...ativa, active: false, revoked_at: '2026-10-11T11:00:00Z' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Revogar Claude do Tony' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(svc.revogar).toHaveBeenCalledWith('k1');
    expect(await screen.findByText('Revogada')).toBeInTheDocument();
  });

  it('erro ao carregar mostra tentar de novo', async () => {
    svc.listar.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByText('Não deu para carregar as chaves')).toBeInTheDocument();
  });

  it('troca Operador/Dono pelo Seletor com PATCH de perfil', async () => {
    svc.mudarPerfil.mockResolvedValue({ ...ativa, profile: 'owner' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.selectOptions(screen.getByLabelText('Perfil: Claude do Tony'), 'owner');
    expect(svc.mudarPerfil).toHaveBeenCalledWith('k1', 'owner');
    await waitFor(() => expect(screen.getByLabelText('Perfil: Claude do Tony')).toHaveValue('owner'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('erro ao mudar avisa e mantém como estava', async () => {
    svc.mudarPerfil.mockRejectedValue(new Error('x'));
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.selectOptions(screen.getByLabelText('Perfil: Claude do Tony'), 'owner');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText('Perfil: Claude do Tony')).toHaveValue('operator');
  });

  it('chave revogada não mostra o Seletor', async () => {
    svc.listar.mockResolvedValue([{ ...ativa, active: false, revoked_at: '2026-10-11T11:00:00Z' }]);
    abrir();
    await screen.findByText('Revogada');
    expect(screen.queryByLabelText('Perfil: Claude do Tony')).not.toBeInTheDocument();
  });
});
