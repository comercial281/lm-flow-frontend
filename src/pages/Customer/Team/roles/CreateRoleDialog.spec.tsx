import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/customRoles/customRolesService', () => ({ customRolesService: { clone: vi.fn() } }));
import CreateRoleDialog from './CreateRoleDialog';

describe('CreateRoleDialog', () => {
  it('nome e "Começar igual a" num grupo, com o nome obrigatório', () => {
    render(<CreateRoleDialog open bases={[{ id: 1, name: 'Corretor', slug: 'corretor' } as any]} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Cargo novo' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do cargo/)).toHaveAttribute('placeholder', 'Ex.: Pré-vendas');
    expect(screen.getByLabelText('Começar igual a')).toBeInTheDocument();
  });
});
