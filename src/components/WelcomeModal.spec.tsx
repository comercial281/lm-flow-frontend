import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Boas-vindas do primeiro acesso: leva pra primeira aula ou fecha de vez.
const navigate = vi.hoisted(() => vi.fn());
const markTourCompleted = vi.hoisted(() => vi.fn());
const markTourSkipped = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ tours: {} as Record<string, unknown> }));

vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ tours: state.tours, markTourCompleted, markTourSkipped }),
}));

import { WelcomeModal, WELCOME_KEY, FIRST_LESSON_PATH } from './WelcomeModal';

const renderIt = () => render(<MemoryRouter><WelcomeModal /></MemoryRouter>);

beforeEach(() => {
  navigate.mockReset();
  markTourCompleted.mockReset();
  markTourSkipped.mockReset();
  state.tours = {};
});

describe('WelcomeModal', () => {
  it('"Assistir a primeira aula" marca a janela como vista e abre a aula do celular', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'welcome.watchButton' }));
    expect(markTourCompleted).toHaveBeenCalledWith(WELCOME_KEY);
    expect(navigate).toHaveBeenCalledWith(FIRST_LESSON_PATH);
    expect(FIRST_LESSON_PATH).toMatch(/^\/academia\/curso\/[\w-]+\?lesson=[\w-]+$/);
  });

  it('"Depois" fecha de vez sem sair da tela', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'welcome.laterButton' }));
    expect(markTourSkipped).toHaveBeenCalledWith(WELCOME_KEY);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('quem já respondeu (inclusive o tour antigo) não vê a janela', () => {
    state.tours = { [WELCOME_KEY]: 'skipped' };
    renderIt();
    expect(screen.queryByText('welcome.title')).toBeNull();
  });
});
