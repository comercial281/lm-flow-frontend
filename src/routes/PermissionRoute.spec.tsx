import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ allowed: false, support: false }));
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({
    can: () => mocks.allowed, canAny: () => mocks.allowed, canAll: () => mocks.allowed, isReady: true, loading: false,
  }),
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => mocks.support }));

import PermissionRoute from './PermissionRoute';

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/ia-vendedora']}>
      <Routes>
        <Route path="/ia-vendedora" element={<PermissionRoute resource="sales_agents" action="read"><p>tela da IA</p></PermissionRoute>} />
        <Route path="/unauthorized" element={<p>página genérica</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('PermissionRoute', () => {
  beforeEach(() => { mocks.allowed = false; mocks.support = false; });

  it('sem permissão mostra o aviso do cargo, nunca a página genérica', () => {
    montar();
    expect(screen.getByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('página genérica')).not.toBeInTheDocument();
    expect(screen.queryByText('tela da IA')).not.toBeInTheDocument();
  });

  it('com permissão abre a tela', () => {
    mocks.allowed = true;
    montar();
    expect(screen.getByText('tela da IA')).toBeInTheDocument();
  });

  it('suporte abre sem esperar permissão', () => {
    mocks.support = true;
    montar();
    expect(screen.getByText('tela da IA')).toBeInTheDocument();
  });
});
