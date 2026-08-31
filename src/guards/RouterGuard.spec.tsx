import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  slug: null as string | null,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ isLoading: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.isAuthenticated ? { id: '1' } : null,
    isAuthenticated: mocks.isAuthenticated,
    logout: vi.fn(),
  }),
}));
vi.mock('@/contexts/PermissionsContext', () => ({ usePermissions: () => ({ isReady: true }) }));
vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => ({ setupRequired: false, setupLoading: false }),
}));
vi.mock('@/utils/requestMonitor', () => ({
  markBootstrapPhaseEnd: vi.fn(),
  markBootstrapPhaseStart: vi.fn(),
}));
vi.mock('@/services/core/tenant', () => ({ getSubdomainSlug: () => mocks.slug }));

import RouterGuard from './RouterGuard';

function renderEm(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <RouterGuard>
        <Routes>
          <Route path="/academia/curso/:id" element={<div>conteudo-da-aula</div>} />
          <Route path="/conversations" element={<div>conversas</div>} />
          <Route path="/login" element={<div>tela-de-login</div>} />
        </Routes>
      </RouterGuard>
    </MemoryRouter>,
  );
}

describe('RouterGuard — Área de Membros', () => {
  beforeEach(() => {
    mocks.isAuthenticated = false;
    mocks.slug = null;
  });

  // O defeito que foi para produção: esta guarda roda ANTES das rotas e mandava
  // para o login todo mundo que não estivesse logado. A porta de entrada da
  // Área de Membros nunca chegava a ser desenhada, e quem clicava no link da
  // aula vindo do WhatsApp caía num login onde não tem conta.
  it('não manda para o login quem abre a aula FORA de um cliente', () => {
    renderEm('/academia/curso/7');

    expect(screen.queryByText('tela-de-login')).not.toBeInTheDocument();
    expect(screen.getByText('conteudo-da-aula')).toBeInTheDocument();
  });

  it('DENTRO de um cliente o login continua sendo o caminho', () => {
    mocks.slug = 'apto-premium';
    renderEm('/academia/curso/7');

    expect(screen.getByText('tela-de-login')).toBeInTheDocument();
  });

  it('rota protegida comum segue indo para o login', () => {
    renderEm('/conversations');

    expect(screen.getByText('tela-de-login')).toBeInTheDocument();
  });
});
