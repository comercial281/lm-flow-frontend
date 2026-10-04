import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: (k: string) => ({ 'profile.feedback': 'Ajuda e suporte', 'profile.myProfile': 'Meu perfil', 'profile.logout': 'Sair' }[k] ?? k),
  }),
}));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ updateAvailability: vi.fn(), currentUser: {} }),
}));
vi.mock('@/services/core/apiAuth', () => ({ default: { post: vi.fn() } }));

import ProfileMenu from './ProfileMenu';

const user = { id: '1', email: 'time@exemplo.com', name: 'Time Suporte' };

function renderMenu(semAjudaESuporte?: boolean) {
  // mobile: a lista aparece direto, sem abrir o dropdown
  return render(
    <MemoryRouter>
      <ProfileMenu user={user} mobile setLogoutDialogOpen={() => {}} semAjudaESuporte={semAjudaESuporte} />
    </MemoryRouter>,
  );
}

describe('ProfileMenu: Ajuda e suporte', () => {
  it('aparece por padrão (CRM do cliente)', () => {
    renderMenu();
    expect(screen.getByText('Ajuda e suporte')).toBeTruthy();
  });

  it('some na Área do Admin, que não monta o SupportWidget', () => {
    renderMenu(true);
    expect(screen.queryByText('Ajuda e suporte')).toBeNull();
    expect(screen.getByText('Sair')).toBeTruthy();
  });
});
