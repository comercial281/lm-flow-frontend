import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { checkContactCredit, toastSuccess, toastError } = vi.hoisted(() => ({
  checkContactCredit: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/components/ui/ds', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: { checkContactCredit: (...args: unknown[]) => checkContactCredit(...args) },
}));
vi.mock('@/utils/apiHelpers', () => ({ apiErrorMessage: (_e: unknown, fallback: string) => fallback }));

import ContactCreditCheck from './ContactCreditCheck';

const baseContact = {
  id: 'c1',
  tax_id: '11122233344',
  additional_attributes: {},
  custom_attributes: {},
} as any;

describe('ContactCreditCheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs the check and shows the result', async () => {
    checkContactCredit.mockResolvedValue({
      credit_check: {
        status: 'clean',
        score: 700,
        summary: 'CPF sem restrição · score 700',
        checked_at: '2026-06-30T12:00:00Z',
        datasets: ['basic_data'],
        provider: 'bigdatacorp',
        has_restriction: false,
      },
    });

    render(<ContactCreditCheck contact={baseContact} />);
    fireEvent.click(screen.getByText(/Consultar CPF/));

    await screen.findByText(/CPF sem restrição/);
    expect(checkContactCredit).toHaveBeenCalledWith('c1');
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('blocks the check when the contact has no CPF', () => {
    const noCpf = { id: 'c2', tax_id: '', additional_attributes: {}, custom_attributes: {} } as any;
    render(<ContactCreditCheck contact={noCpf} />);
    expect(screen.getByText(/Cadastre o CPF/)).toBeTruthy();
    expect(checkContactCredit).not.toHaveBeenCalled();
  });
});
