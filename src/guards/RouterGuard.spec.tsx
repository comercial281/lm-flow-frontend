import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

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

// A tela de login mostra o destino que recebeu, para o teste conferir que ele
// sobreviveu ao redirecionamento.
function LoginFalso() {
  const { search } = useLocation();
  return <div>tela-de-login{search}</div>;
}

function renderEm(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <RouterGuard>
        <Routes>
          <Route path="/academia/curso/:id" element={<div>conteudo-da-aula</div>} />
          <Route path="/conversations" element={<div>conversas</div>} />
          <Route path="/login" element={<LoginFalso />} />
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

    expect(screen.queryByText(/tela-de-login/)).not.toBeInTheDocument();
    expect(screen.getByText('conteudo-da-aula')).toBeInTheDocument();
  });

  it('DENTRO de um cliente o login continua sendo o caminho', () => {
    mocks.slug = 'apto-premium';
    renderEm('/academia/curso/7');

    expect(screen.getByText(/tela-de-login/)).toBeInTheDocument();
  });

  it('rota protegida comum segue indo para o login', () => {
    renderEm('/conversations');

    expect(screen.getByText(/tela-de-login/)).toBeInTheDocument();
  });

  // Esta guarda é a ÚLTIMA a navegar (efeito do pai, depois do <Navigate> das
  // rotas filhas), então um /login sem returnUrl aqui apaga o destino que as
  // rotas tinham preservado. Foi o que fez quem abria o link da aula logar e
  // cair na aba de conversas em vez da aula.
  it('leva o destino junto para o login, para voltar à aula depois de entrar', () => {
    mocks.slug = 'apto-premium';
    renderEm('/academia/curso/7');

    expect(screen.getByText(/returnUrl=%2Facademia%2Fcurso%2F7/)).toBeInTheDocument();
  });
});
