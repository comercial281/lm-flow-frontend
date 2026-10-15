import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import profile from '@/i18n/locales/pt-BR/profile.json';

// t de verdade (lê o pt-BR), pra o teste enxergar o texto que a pessoa vê.
const t = vi.hoisted(() => (key: string) => key);
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], profile) as string ?? t(key),
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { mfa_enabled: false } }) }));
vi.mock('@/services/profile/twoFactorService', () => ({
  twoFactorService: { enable: vi.fn(), verify: vi.fn(), disable: vi.fn(), regenerateBackupCodes: vi.fn(), sendEmailCode: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TwoFactorSetup from './TwoFactorSetup';

describe('TwoFactorSetup · passo de ativar', () => {
  it('o passo do método tem o grupo "Método" e as duas opções de escolha', async () => {
    render(<TwoFactorSetup />);
    await userEvent.click(screen.getByRole('button', { name: profile.twoFactor.actions.enable }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('group', { name: /método/i })).toBeInTheDocument();
    const escolhas = within(janela).getByRole('radiogroup');
    expect(within(escolhas).getAllByRole('radio')).toHaveLength(2);
  });
});
