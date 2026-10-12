import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({ create: vi.fn(async () => ({})), update: vi.fn(async () => undefined), tenant: '' }));
vi.mock('@/hooks/useKnowledge', () => ({
  get TENANT_SLUG() { return m.tenant; },
  useCreateModule: () => ({ mutateAsync: m.create, isPending: false }),
  useUpdateModule: () => ({ mutateAsync: m.update, isPending: false }),
  useCourses: () => ({ data: [{ id: 'c1', titulo: 'Como usar o LM Flow' }] }),
  useUploadModuleCover: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEntitlements: () => ({ data: [] }),
  useSetEntitlement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnsetEntitlement: () => ({ mutate: vi.fn() }),
}));

import ModuleForm from './ModuleForm';

beforeEach(() => { m.create.mockClear(); m.update.mockClear(); m.tenant = ''; });

describe('ModuleForm (janela)', () => {
  it('cria com Quem assiste = Só gestores e administradores', async () => {
    render(<ModuleForm editing={null} defaultCourseId="c1" onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Novo módulo' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Nome do módulo'), 'Para gestores');
    await userEvent.click(screen.getByRole('radio', { name: 'Só gestores e administradores' }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar módulo' }));
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Para gestores', audience: 'managers', course_id: 'c1' }));
  });

  it('sem cliente no endereço, não mostra "Em quais clientes aparece"', () => {
    render(<ModuleForm editing={null} onClose={() => {}} />);
    expect(screen.queryByText('Em quais clientes aparece')).toBeNull();
  });

  it('com cliente no endereço, mostra a escolha', () => {
    m.tenant = 'moeda';
    render(<ModuleForm editing={null} onClose={() => {}} />);
    expect(screen.getByText('Em quais clientes aparece')).toBeTruthy();
  });

  it('Avançado começa fechado', () => {
    render(<ModuleForm editing={null} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Avançado/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Livre (todos abrem)')).toBeNull();
  });
});
