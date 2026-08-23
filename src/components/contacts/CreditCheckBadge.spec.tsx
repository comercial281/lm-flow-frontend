import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/ds', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

import CreditCheckBadge from './CreditCheckBadge';

describe('CreditCheckBadge', () => {
  it('renders clean label', () => {
    render(<CreditCheckBadge status="clean" />);
    expect(screen.getByText(/CPF limpo/)).toBeTruthy();
  });

  it('renders restriction label with score', () => {
    render(<CreditCheckBadge status="restricted" score={620} />);
    expect(screen.getByText(/CPF com restrição/)).toBeTruthy();
    expect(screen.getByText(/620/)).toBeTruthy();
  });

  it('renders unknown label', () => {
    render(<CreditCheckBadge status="unknown" />);
    expect(screen.getByText(/CPF consultado/)).toBeTruthy();
  });

  it('uses compact labels on the kanban card', () => {
    render(<CreditCheckBadge status="clean" compact />);
    expect(screen.getByText(/Limpo/)).toBeTruthy();
  });
});
