import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// A guarda depende só de duas coisas: se a pessoa está logada e se o endereço
// aberto é de um cliente.
const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  slug: null as string | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, isLoading: mocks.isLoading }),
}));

vi.mock('@/services/core/tenant', () => ({
  getSubdomainSlug: () => mocks.slug,
}));

vi.mock('@/pages/Customer/Academia/AcademyEntry', () => ({
  default: () => <div>porta-de-entrada</div>,
}));

import AcademiaRoute from './AcademiaRoute';

function renderRota() {
  return render(
    <MemoryRouter initialEntries={['/academia/curso/7?lesson=9']}>
      <Routes>
        <Route
          path="/academia/curso/:courseId"
          element={
            <AcademiaRoute>
              <div>a-aula</div>
            </AcademiaRoute>
          }
        />
        <Route path="/login" element={<div>tela-de-login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcademiaRoute', () => {
  beforeEach(() => {
    mocks.isAuthenticated = false;
    mocks.isLoading = false;
    mocks.slug = null;
  });

  it('logado vê a aula', () => {
    mocks.isAuthenticated = true;
    mocks.slug = 'apto-premium';
    renderRota();

    expect(screen.getByText('a-aula')).toBeInTheDocument();
  });

  // O caso que originou tudo: o link da aula caiu num endereço que não é de
  // cliente nenhum. Mandar para o login ali é mandar para uma conta que não
  // existe — foi o "erro ao entrar na conta" que os clientes relataram.
  it('deslogado FORA de um cliente vê a porta de entrada, não o login', () => {
    mocks.slug = null;
    renderRota();

    expect(screen.getByText('porta-de-entrada')).toBeInTheDocument();
    expect(screen.queryByText('tela-de-login')).not.toBeInTheDocument();
  });

  it('deslogado DENTRO de um cliente segue para o login de sempre', () => {
    mocks.slug = 'apto-premium';
    renderRota();

    expect(screen.getByText('tela-de-login')).toBeInTheDocument();
  });
});
