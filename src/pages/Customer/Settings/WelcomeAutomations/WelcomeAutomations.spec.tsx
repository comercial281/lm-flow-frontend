import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ getAll: vi.fn(), create: vi.fn() }));
vi.mock('@/services/welcomeAutomations/welcomeAutomationsService', () => ({
  welcomeAutomationsService: { getAll: mocks.getAll, create: mocks.create, update: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WelcomeAutomations from './WelcomeAutomations';

describe('Janela de automação de boas-vindas', () => {
  it('tem os grupos do miolo e os botões da mensagem mostram nome humano', async () => {
    mocks.getAll.mockResolvedValue([]);
    render(<WelcomeAutomations />);
    await userEvent.click((await screen.findAllByRole('button', { name: /Nova Automação/ }))[0]);
    const dialogo = await screen.findByRole('dialog');
    for (const nome of ['Automação', 'Mensagem', 'Estado']) {
      expect(within(dialogo).getByRole('group', { name: nome })).toBeInTheDocument();
    }
    expect(within(dialogo).getByRole('button', { name: 'Nome do lead' })).toBeInTheDocument();
    expect(within(dialogo).queryByText('{{lead_name}}')).not.toBeInTheDocument();
  });

  it('o botão Nome do lead coloca a variável no texto gravado', async () => {
    mocks.getAll.mockResolvedValue([]);
    render(<WelcomeAutomations />);
    await userEvent.click((await screen.findAllByRole('button', { name: /Nova Automação/ }))[0]);
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Nome do lead' }));
    expect(within(dialogo).getByLabelText(/^Texto da mensagem/)).toHaveValue('{{lead_name}}');
  });
});
