import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/macros', () => ({
  macrosService: {
    getFormData: vi.fn().mockResolvedValue({ inboxes: [], agents: [], teams: [], labels: [], campaigns: [] }),
    createMacro: vi.fn(),
    updateMacro: vi.fn(),
  },
}));
// t() lê o pt-BR de verdade, pra o teste ver o texto que a pessoa vê.
vi.mock('@/hooks/useLanguage', async () => {
  const macros = (await import('@/i18n/locales/pt-BR/macros.json')).default as Record<string, unknown>;
  const ler = (chave: string) => chave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], macros);
  return { useLanguage: () => ({ t: (chave: string) => (typeof ler(chave) === 'string' ? ler(chave) : chave) }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MacroFormModal from './MacroFormModal';

describe('Janela de macro', () => {
  it('tem os grupos Identificação e Ações, e a visibilidade é uma escolha marcada', async () => {
    render(<MacroFormModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('group', { name: 'Identificação' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('group', { name: 'Ações' })).toBeInTheDocument();
    const privada = within(dialogo).getByRole('radio', { name: /Privada/ });
    expect(privada).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(dialogo).getByRole('radio', { name: /Pública/ }));
    expect(within(dialogo).getByRole('radio', { name: /Pública/ })).toHaveAttribute('aria-checked', 'true');
  });
});
