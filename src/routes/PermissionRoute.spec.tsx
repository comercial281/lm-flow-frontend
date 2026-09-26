import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ allowed: false, support: false, isReady: true, loading: false }));
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({
    can: () => mocks.allowed, canAny: () => mocks.allowed, canAll: () => mocks.allowed, isReady: mocks.isReady, loading: mocks.loading,
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

// Igual a `montar()`, mas o PermissionRoute recebe `redirectTo` explícito —
// o caso de quem AINDA quer o redirecionamento (não é o padrão da Fase 1,
// mas continua suportado).
const montarComRedirectExplicito = () =>
  render(
    <MemoryRouter initialEntries={['/ia-vendedora']}>
      <Routes>
        <Route
          path="/ia-vendedora"
          element={
            <PermissionRoute resource="sales_agents" action="read" redirectTo="/unauthorized">
              <p>tela da IA</p>
            </PermissionRoute>
          }
        />
        <Route path="/unauthorized" element={<p>página genérica</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('PermissionRoute', () => {
  beforeEach(() => { mocks.allowed = false; mocks.support = false; mocks.isReady = true; mocks.loading = false; });

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

  it('enquanto as permissões carregam, mostra carregando — nunca o aviso do cargo nem a tela (sem flash)', () => {
    mocks.loading = true;
    mocks.isReady = false;
    const { container } = montar();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText('tela da IA')).not.toBeInTheDocument();
    expect(screen.queryByText('página genérica')).not.toBeInTheDocument();
  });

  it('sem permissão e com redirectTo explícito, redireciona em vez de mostrar o aviso do cargo', () => {
    montarComRedirectExplicito();
    expect(screen.getByText('página genérica')).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText('tela da IA')).not.toBeInTheDocument();
  });
});
