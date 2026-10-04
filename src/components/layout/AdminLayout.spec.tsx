import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ ehSuporte: true, abertos: vi.fn() }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => mocks.ehSuporte }));
vi.mock('@/pages/SuperAdmin/Suporte/useChamadosAbertos', () => ({
  useChamadosAbertos: (ativo: boolean) => {
    mocks.abertos(ativo);
    return ativo ? 4 : 0;
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.test' }, logout: vi.fn() }) }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/DemoModeToggle', () => ({ DemoModeToggle: () => null }));
vi.mock('./components/ProfileMenu', () => ({ default: () => null }));

import AdminLayout from './AdminLayout';

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>
    </MemoryRouter>,
  );

describe('AdminLayout — item Suporte', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suporte: item e número de Abertos nos dois menus', () => {
    mocks.ehSuporte = true;
    montar();
    expect(mocks.abertos).toHaveBeenCalledWith(true);
    const lateral = screen.getByRole('navigation', { name: 'Menu da Área do Admin' });
    expect(within(lateral).getByRole('link', { name: /Suporte/ })).toBeInTheDocument();
    expect(within(lateral).getByLabelText('4 chamados abertos')).toBeInTheDocument();
    // menu horizontal do celular: 2º link "Suporte" com o mesmo número
    expect(screen.getAllByRole('link', { name: /Suporte/ })).toHaveLength(2);
    expect(screen.getAllByLabelText('4 chamados abertos')).toHaveLength(2);
  });

  it('não suporte: item some dos dois menus e o número nem é buscado', () => {
    mocks.ehSuporte = false;
    montar();
    expect(mocks.abertos).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('link', { name: /Suporte/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/chamados abertos/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Visão Geral' })).toHaveLength(2);
  });
});
