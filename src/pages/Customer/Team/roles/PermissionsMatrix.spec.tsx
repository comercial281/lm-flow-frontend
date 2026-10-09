import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const s = vi.hoisted(() => ({
  perms: new Set<string>(),
  capabilities: vi.fn(),
  updateCapabilities: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ can: (r: string, a: string) => s.perms.has(`${r}.${a}`) }),
}));
vi.mock('@/services/customRoles/customRolesService', async () => {
  const real = await vi.importActual<typeof import('@/services/customRoles/customRolesService')>('@/services/customRoles/customRolesService');
  return {
    ...real,
    customRolesService: { capabilities: s.capabilities, updateCapabilities: s.updateCapabilities },
  };
});

import PermissionsMatrix from './PermissionsMatrix';

const themes = [
  { key: 'atend', label: 'Atendimento', rows: [
    { key: 'ver', label: 'Ver conversas', hint: 'Abrir o histórico' },
    { key: 'env', label: 'Responder conversas', hint: '' },
  ] },
  { key: 'imv', label: 'Imóveis', rows: [{ key: 'cad', label: 'Cadastrar imóveis', hint: 'Incluir novos' }] },
];
const papel = (over: object) => ({
  id: 1, name: 'X', slug: 'x', system: true, color: '#111', users_count: 2, inherits_from_id: null, inherits_from_name: null,
  always_full: false, states: {}, ...over,
});
const roles = [
  papel({ id: 1, name: 'Administrador', always_full: true, users_count: 1, states: { ver: 'on', env: 'on', cad: 'on' } }),
  papel({ id: 2, name: 'Gerente', states: { ver: 'on', env: 'partial', cad: 'off' } }),
  papel({ id: 3, name: 'Corretor', states: { ver: 'off', env: 'off', cad: 'off' } }),
  papel({ id: 9, name: 'SDR', system: false, users_count: 1, inherits_from_id: 3, inherits_from_name: 'Corretor', states: { ver: 'on', env: 'off', cad: 'off' } }),
];

function abrir() {
  render(<MemoryRouter><PermissionsMatrix /></MemoryRouter>);
}
const sw = (cargo: string, linha: string) => screen.getByRole('switch', { name: `${cargo}: ${linha}` });

describe('PermissionsMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.perms = new Set(['roles.read', 'roles.update']);
    s.capabilities.mockResolvedValue({ themes, roles });
    s.updateCapabilities.mockImplementation(async (id: number, c: Record<string, boolean>) => {
      const r = roles.find(x => x.id === id)!;
      const states = { ...r.states } as Record<string, string>;
      Object.entries(c).forEach(([k, v]) => { states[k] = v ? 'on' : 'off'; });
      return { ...r, states };
    });
  });

  it('mostra temas, linhas, colunas, cabeçalho e herança', async () => {
    abrir();
    await screen.findByText('Atendimento');
    expect(screen.getByText('Imóveis')).toBeInTheDocument();
    expect(screen.getByText('Ver conversas')).toBeInTheDocument();
    expect(screen.getByText('Abrir o histórico')).toBeInTheDocument();
    const cabecas = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(cabecas[1]).toContain('Administrador');
    expect(screen.getAllByText('2 pessoas')).toHaveLength(2);
    expect(screen.getByText('1 pessoa')).toBeInTheDocument();
    expect(screen.getByText(/personalizado · 1 pessoa/)).toBeInTheDocument();
    expect(screen.getByText('herda de Corretor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver a lista completa/ })).toHaveAttribute('href', '/equipe/cargos/lista');
  });

  it('administrador fica travado, sem interruptor', async () => {
    abrir();
    await screen.findByText('Atendimento');
    expect(screen.queryByRole('switch', { name: /^Administrador:/ })).toBeNull();
    expect(screen.getAllByTitle('O administrador sempre pode tudo')).toHaveLength(3);
    expect(screen.getAllByText('Sempre')).toHaveLength(3);
  });

  it('parcial: aria mixed, clique liga e marca a bolinha', async () => {
    abrir();
    await screen.findByText('Atendimento');
    const el = sw('Gerente', 'Responder conversas');
    expect(el).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(el);
    expect(sw('Gerente', 'Responder conversas')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId('mudou')).toHaveLength(1);
    expect(screen.getByText('1 mudança ainda não salva')).toBeInTheDocument();
  });

  it('salva uma chamada por cargo, só com as linhas dele', async () => {
    abrir();
    await screen.findByText('Atendimento');
    await userEvent.click(sw('Gerente', 'Cadastrar imóveis'));
    await userEvent.click(sw('Gerente', 'Ver conversas'));
    await userEvent.click(sw('Corretor', 'Ver conversas'));
    expect(screen.getByText('3 mudanças ainda não salvas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(s.updateCapabilities).toHaveBeenCalledTimes(2));
    expect(s.updateCapabilities).toHaveBeenCalledWith(2, { cad: true, ver: false });
    expect(s.updateCapabilities).toHaveBeenCalledWith(3, { ver: true });
    expect(await screen.findByText('Tudo salvo')).toBeInTheDocument();
    expect(sw('Corretor', 'Ver conversas')).toHaveAttribute('aria-checked', 'true');
  });

  it('falha parcial: mantém o rascunho do cargo que falhou e mostra a frase', async () => {
    s.updateCapabilities.mockImplementation(async (id: number, c: Record<string, boolean>) => {
      if (id === 9) throw { response: { data: { success: false, error: 'Essa permissão vem do cargo “Corretor”. Desligue lá.' } } };
      return { ...roles.find(x => x.id === id)!, states: { ver: 'on', env: 'off', cad: c.cad ? 'on' : 'off' } };
    });
    abrir();
    await screen.findByText('Atendimento');
    await userEvent.click(sw('Gerente', 'Cadastrar imóveis'));
    await userEvent.click(sw('SDR', 'Ver conversas'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('SDR: Essa permissão vem do cargo “Corretor”. Desligue lá.')).toBeInTheDocument();
    expect(screen.getByText('1 mudança ainda não salva')).toBeInTheDocument();
    expect(sw('SDR', 'Ver conversas')).toHaveAttribute('aria-checked', 'false');
    expect(sw('Gerente', 'Cadastrar imóveis')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId('mudou')).toHaveLength(1);
  });

  it('sem roles.update: só leitura e sem barra', async () => {
    s.perms = new Set(['roles.read']);
    abrir();
    await screen.findByText('Atendimento');
    expect(sw('Gerente', 'Ver conversas')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByText('Tudo salvo')).toBeNull();
  });

  it('sem roles.read: aviso da casa e nenhuma chamada', () => {
    s.perms = new Set();
    abrir();
    expect(screen.getByText(/Seu cargo não tem acesso a esta tela/)).toBeInTheDocument();
    expect(s.capabilities).not.toHaveBeenCalled();
  });

  it('busca ignora acento e esconde temas vazios', async () => {
    abrir();
    await screen.findByText('Atendimento');
    await userEvent.type(screen.getByLabelText('Buscar permissão'), 'imoveis');
    expect(screen.getByText('Cadastrar imóveis')).toBeInTheDocument();
    expect(screen.queryByText('Ver conversas')).toBeNull();
    expect(screen.queryByText('Atendimento')).toBeNull();
    await userEvent.clear(screen.getByLabelText('Buscar permissão'));
    await userEvent.type(screen.getByLabelText('Buscar permissão'), 'historico');
    expect(screen.getByText('Ver conversas')).toBeInTheDocument();
    expect(screen.queryByText('Imóveis')).toBeNull();
  });

  it('Desfazer limpa o rascunho', async () => {
    abrir();
    await screen.findByText('Atendimento');
    await userEvent.click(sw('Corretor', 'Ver conversas'));
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
    expect(sw('Corretor', 'Ver conversas')).toHaveAttribute('aria-checked', 'false');
    expect(within(screen.getByTestId('quadro-permissoes')).queryAllByTestId('mudou')).toHaveLength(0);
    expect(s.updateCapabilities).not.toHaveBeenCalled();
  });
});
