import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const s = vi.hoisted(() => ({
  perms: new Set<string>(),
  capabilities: vi.fn(),
  permissionsCatalog: vi.fn(),
  get: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ can: (r: string, a: string) => s.perms.has(`${r}.${a}`) }),
}));
vi.mock('@/services/customRoles/customRolesService', () => ({
  customRolesService: { capabilities: s.capabilities, permissionsCatalog: s.permissionsCatalog, get: s.get },
}));
vi.mock('@/pages/Customer/Settings/Roles/RoleEditorModal', () => ({
  default: (p: { role: { name: string } | null }) => <div data-testid="editor">{p.role ? `editar ${p.role.name}` : 'novo cargo'}</div>,
}));

import RoleCards from './RoleCards';

const themes = [
  { key: 'imoveis', label: 'Imóveis', rows: [{ key: 'imv', label: 'Cadastrar imóveis', hint: '' }] },
  { key: 'atend', label: 'Atendimento', rows: [{ key: 'ver', label: 'Ver conversas', hint: '' }, { key: 'env', label: 'Responder conversas', hint: '' }] },
  { key: 'leads', label: 'Leads e Funil', rows: [{ key: 'lead', label: 'Ver leads', hint: '' }, { key: 'mover', label: 'Mover no funil', hint: '' }] },
  { key: 'eq', label: 'Equipe e números', rows: [{ key: 'eqp', label: 'Gerenciar pessoas', hint: '' }, { key: 'num', label: 'Criar números', hint: '' }] },
];
const papel = (over: object) => ({
  id: 1, name: 'X', slug: 'x', system: true, color: '#111', users_count: 2, inherits_from_id: null, inherits_from_name: null,
  always_full: false, states: {}, ...over,
});
const roles = [
  papel({ id: 1, name: 'Administrador', always_full: true, users_count: 1, states: { imv: 'on', ver: 'on', env: 'on', lead: 'on', mover: 'on', eqp: 'on', num: 'on' } }),
  papel({ id: 2, name: 'Gerente', states: { imv: 'on', ver: 'on', env: 'on', lead: 'on', mover: 'on', eqp: 'off', num: 'off' } }),
  papel({ id: 3, name: 'Corretor', states: { imv: 'off', ver: 'off', env: 'off', lead: 'on', mover: 'on', eqp: 'off', num: 'off' } }),
  papel({ id: 9, name: 'SDR', system: false, users_count: 0, states: { lead: 'on' } }),
];

function abrir() {
  render(<MemoryRouter><RoleCards /></MemoryRouter>);
}

describe('RoleCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.perms = new Set();
    s.capabilities.mockResolvedValue({ themes, roles });
    s.permissionsCatalog.mockResolvedValue([]);
    s.get.mockImplementation(async (id: number) => ({ id, name: roles.find(r => r.id === id)!.name }));
  });

  it('um cartão por cargo, na ordem do servidor, com selo e contagem', async () => {
    abrir();
    await screen.findByText('Gerente');
    const nomes = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(nomes.slice(0, 4)).toEqual(['Administrador', 'Gerente', 'Corretor', 'SDR']);
    expect(screen.getAllByText('Pronto pra usar')).toHaveLength(3);
    expect(within(screen.getByTestId('cargo-1')).getByText('1 pessoa')).toBeInTheDocument();
    expect(within(screen.getByTestId('cargo-2')).getByText('2 pessoas')).toBeInTheDocument();
  });

  it('pode: até 3, temas prioritários primeiro; não pode: até 2', async () => {
    abrir();
    const gerente = within(await screen.findByTestId('cargo-2'));
    // Leads e Funil, depois Atendimento; Imóveis (4º) fica de fora pelo limite de 3
    expect(gerente.getByText('Ver leads')).toBeInTheDocument();
    expect(gerente.getByText('Mover no funil')).toBeInTheDocument();
    expect(gerente.getByText('Ver conversas')).toBeInTheDocument();
    expect(gerente.queryByText('Responder conversas')).toBeNull();
    expect(gerente.queryByText('Cadastrar imóveis')).toBeNull();
    expect(gerente.getByText('Gerenciar pessoas')).toBeInTheDocument();
    expect(gerente.getByText('Criar números')).toBeInTheDocument();
  });

  it('administrador: "Pode tudo, sempre." e sem listas', async () => {
    abrir();
    const adm = within(await screen.findByTestId('cargo-1'));
    expect(adm.getByText('Pode tudo, sempre.')).toBeInTheDocument();
    expect(adm.queryByText('Ver leads')).toBeNull();
  });

  it('criar cargo só com roles.create; abre o editor em modo novo', async () => {
    abrir();
    await screen.findByText('Cargos personalizados');
    expect(screen.queryByRole('button', { name: /Criar cargo personalizado/ })).toBeNull();
  });

  it('com roles.create, o clique carrega o catálogo e abre o editor', async () => {
    s.perms = new Set(['roles.create']);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Criar cargo personalizado/ }));
    expect(await screen.findByTestId('editor')).toHaveTextContent('novo cargo');
    expect(s.permissionsCatalog).toHaveBeenCalledTimes(1);
  });

  it('"Ver tudo o que pode" só com roles.update, e não no administrador', async () => {
    abrir();
    await screen.findByText('Gerente');
    expect(screen.queryByRole('button', { name: 'Ver tudo o que pode' })).toBeNull();
  });

  it('com roles.update, abre o editor do cargo', async () => {
    s.perms = new Set(['roles.update']);
    abrir();
    await screen.findByText('Gerente');
    const botoes = screen.getAllByRole('button', { name: 'Ver tudo o que pode' });
    expect(botoes).toHaveLength(3);
    await userEvent.click(botoes[0]);
    expect(await screen.findByTestId('editor')).toHaveTextContent('editar Gerente');
  });

  it('erro: mensagem e "Tentar de novo" recarrega', async () => {
    s.capabilities.mockRejectedValueOnce(new Error('x'));
    abrir();
    expect(await screen.findByText('Não consegui carregar os cargos.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('Gerente')).toBeInTheDocument());
  });
});
