import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { phone_number: '+5511988887777' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/services/bolsao/bolsaoService', () => ({ default: { createTestLead: vi.fn() } }));
import BolsaoTestLeadDialog from './BolsaoTestLeadDialog';

describe('BolsaoTestLeadDialog', () => {
  it('campos em um grupo e o número vem avisado na caixa Aviso', () => {
    render(<BolsaoTestLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Dados do lead' })).toBeInTheDocument();
    expect(screen.getByText(/Quem puxar esse lead vai mandar mensagem/).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Criar lead de teste' })).toBeInTheDocument();
  });
});
