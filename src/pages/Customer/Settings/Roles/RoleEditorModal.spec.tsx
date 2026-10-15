import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/customRoles/customRolesService', () => ({ customRolesService: svc }));
import RoleEditorModal from './RoleEditorModal';

const catalog = [
  {
    key: 'leads', label: 'Leads',
    resources: [{ resource: 'leads', label: 'Leads', actions: [
      { permission: 'leads.read', label: 'Ver' },
      { permission: 'leads.update', label: 'Editar' },
    ] }],
  },
] as any;

describe('RoleEditorModal', () => {
  it('Identificação e Permissões em grupos; permissão grava ordenada', async () => {
    svc.create.mockResolvedValue({ id: 1 });
    const onSaved = vi.fn();
    render(<RoleEditorModal open onClose={vi.fn()} role={null} catalog={catalog} onSaved={onSaved} />);
    expect(screen.getByRole('heading', { name: 'Novo cargo' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Identificação' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Permissões/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Azul' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Nome/), 'SDR');
    const caixa = screen.getByRole('heading', { name: 'Leads' }).closest('section') as HTMLElement;
    await userEvent.click(within(caixa).getByRole('button', { name: 'Marcar tudo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'SDR', permissions: ['leads.read', 'leads.update'] }));
  });

  it('cargo novo abre com as áreas fechadas; o botão abre; cargo com permissão marcada abre a área', async () => {
    const { unmount } = render(<RoleEditorModal open onClose={vi.fn()} role={null} catalog={catalog} onSaved={vi.fn()} />);
    const botao = screen.getByRole('button', { name: 'Abrir Leads' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Marcar tudo' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Ver')).toBeNull();
    await userEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Recolher Leads' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Ver')).toBeVisible();
    unmount();
    render(<RoleEditorModal open onClose={vi.fn()} role={{ id: 2, name: 'X', permissions: ['leads.read'] } as any} catalog={catalog} onSaved={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Recolher Leads' })).toHaveAttribute('aria-expanded', 'true');
  });
});
