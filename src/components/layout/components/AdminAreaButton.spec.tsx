import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mocks controláveis por teste — o botão depende só destas duas funções puras.
const mocks = vi.hoisted(() => ({
  isSuper: false,
  isRootHost: false,
}));

vi.mock('@/hooks/useIsSuperAdmin', () => ({
  useIsSuperAdmin: () => mocks.isSuper,
  SUPER_ADMIN_EMAIL: 'comercial@lealmidia.com.br',
}));

vi.mock('../config/menuItems', () => ({
  isRootTenantHost: () => mocks.isRootHost,
}));

import AdminAreaButton from './AdminAreaButton';

function renderBtn() {
  return render(
    <MemoryRouter>
      <AdminAreaButton />
    </MemoryRouter>,
  );
}

describe('AdminAreaButton', () => {
  beforeEach(() => {
    mocks.isSuper = false;
    mocks.isRootHost = false;
  });

  // O caso que mais importa: este botão é montado no Header de TODO usuário de
  // TODO tenant. Se vazar pro cliente, ele vê a porta do painel da Leal Mídia.
  it('não renderiza nada pro usuário comum em subdomínio de cliente', () => {
    const { container } = renderBtn();
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza pro super-admin fora do host raiz', () => {
    mocks.isSuper = true;
    mocks.isRootHost = false;
    const { container } = renderBtn();
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza pra usuário comum no host raiz', () => {
    mocks.isSuper = false;
    mocks.isRootHost = true;
    const { container } = renderBtn();
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza e aponta pra /admin só quando é super-admin no host raiz', () => {
    mocks.isSuper = true;
    mocks.isRootHost = true;
    renderBtn();
    const link = screen.getByRole('link', { name: /ÁREA DO ADMIN/i });
    expect(link).toHaveAttribute('href', '/admin');
  });
});
