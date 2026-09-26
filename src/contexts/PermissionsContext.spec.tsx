import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: { id: 'gestor' } as { id: string } | null,
  perms: { gestor: ['sales_agents.read'], corretor: ['contacts.read'] } as Record<string, string[]>,
  clearCache: vi.fn(),
}));
const atuais = () => (mocks.user ? mocks.perms[mocks.user.id] ?? [] : []);

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/permissions', () => ({
  permissionsService: {
    clearCache: (...a: unknown[]) => mocks.clearCache(...a),
    getResourceActions: vi.fn(async () => ({ data: { all_permissions: atuais().map(key => ({ key, display_name: key })) } })),
    getUserPermissions: vi.fn(async () => atuais()),
    getAccountPermissions: vi.fn(async () => atuais()),
  },
}));

import { useAuthStore } from '@/store/authStore';
import { permissionsService } from '@/services/permissions';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

function Sonda() {
  const { can, isReady } = usePermissions();
  if (!isReady) return <p>carregando</p>;
  return <p>{can('sales_agents', 'read') ? 'vê IA' : 'não vê IA'}</p>;
}
const arvore = () => <PermissionsProvider><Sonda /></PermissionsProvider>;

describe('PermissionsProvider na troca de pessoa', () => {
  beforeEach(() => {
    mocks.user = { id: 'gestor' };
    mocks.clearCache.mockClear();
    useAuthStore.setState({ isLoggedIn: true });
  });

  it('o corretor que entra depois do gestor NÃO herda o menu do gestor', async () => {
    const { rerender } = render(arvore());
    expect(await screen.findByText('vê IA')).toBeInTheDocument();
    mocks.user = { id: 'corretor' };
    rerender(arvore());
    expect(await screen.findByText('não vê IA')).toBeInTheDocument();
    expect(mocks.clearCache).toHaveBeenCalled();
  });

  it('logout limpa o cache do serviço', async () => {
    const { rerender } = render(arvore());
    await screen.findByText('vê IA');
    mocks.clearCache.mockClear();
    mocks.user = null;
    rerender(arvore());
    expect(mocks.clearCache).toHaveBeenCalled();
  });

  it('o mesmo usuário re-renderizando NÃO busca de novo nem limpa o cache', async () => {
    const { rerender } = render(arvore());
    await screen.findByText('vê IA');
    mocks.clearCache.mockClear();
    vi.mocked(permissionsService.getUserPermissions).mockClear();
    vi.mocked(permissionsService.getAccountPermissions).mockClear();

    // Mesmo id de usuário (nova referência de objeto, como um re-render comum) —
    // não é troca de pessoa nem logout.
    mocks.user = { id: 'gestor' };
    rerender(arvore());
    await screen.findByText('vê IA');

    expect(mocks.clearCache).not.toHaveBeenCalled();
    expect(permissionsService.getUserPermissions).not.toHaveBeenCalled();
    expect(permissionsService.getAccountPermissions).not.toHaveBeenCalled();
  });
});
