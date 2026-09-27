import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useCan } from './useCan';
import { PermissionsContext } from '@/contexts/PermissionsContext';

const isSuperAdminMock = vi.fn();
vi.mock('@/hooks/useIsSuperAdmin', () => ({
  useIsSuperAdmin: () => isSuperAdminMock(),
}));

describe('useCan', () => {
  it('sem PermissionsContext (tela isolada em spec) não esconde nada', () => {
    isSuperAdminMock.mockReturnValue(false);
    const { result } = renderHook(() => useCan());
    expect(result.current('sales_agents', 'create')).toBe(true);
    expect(result.current('portals', 'read')).toBe(true);
  });

  it('suporte (useIsSuperAdmin true) vê tudo, mesmo com o contexto negando', () => {
    isSuperAdminMock.mockReturnValue(true);
    const canMock = vi.fn().mockReturnValue(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PermissionsContext.Provider
        value={{
          userPermissions: [],
          accountPermissions: [],
          can: canMock,
          canAny: vi.fn(),
          canAll: vi.fn(),
          loading: false,
          isReady: true,
          error: null,
          refreshPermissions: vi.fn(),
          createPermission: vi.fn(),
          isValidPermission: vi.fn(),
          getPermissionDisplayName: vi.fn(),
        }}
      >
        {children}
      </PermissionsContext.Provider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(result.current('sales_agents', 'delete')).toBe(true);
    expect(canMock).not.toHaveBeenCalled();
  });

  it('com provider, delega a ctx.can', () => {
    isSuperAdminMock.mockReturnValue(false);
    const canMock = vi.fn().mockReturnValue(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PermissionsContext.Provider
        value={{
          userPermissions: [],
          accountPermissions: [],
          can: canMock,
          canAny: vi.fn(),
          canAll: vi.fn(),
          loading: false,
          isReady: true,
          error: null,
          refreshPermissions: vi.fn(),
          createPermission: vi.fn(),
          isValidPermission: vi.fn(),
          getPermissionDisplayName: vi.fn(),
        }}
      >
        {children}
      </PermissionsContext.Provider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(result.current('portals', 'update')).toBe(false);
    expect(canMock).toHaveBeenCalledWith('portals', 'update');
  });
});
