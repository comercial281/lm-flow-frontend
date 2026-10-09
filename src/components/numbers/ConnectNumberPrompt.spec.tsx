import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// "Conecte seu número" no primeiro acesso: leitura de fundo, falha é silenciosa,
// "Depois" vale só para a sessão do navegador.
const myNumbers = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ support: false, tours: { 'onboarding:welcome': true } as Record<string, unknown> }));

vi.mock('@/services/numbers/numbersService', () => ({ default: { myNumbers } }));
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => state.support }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ tours: state.tours, currentUser: { id: 'u1' } }),
}));

import ConnectNumberPrompt, { DISMISS_KEY } from './ConnectNumberPrompt';

const fresh = { inbox_id: 'i1', name: 'WhatsApp Ana', phone: null, connection: 'disconnected' as const, principal: true, never_connected: true };
const ok = { inbox_id: 'i2', name: 'Outro', phone: null, connection: 'connected' as const, principal: false, never_connected: false };

const renderIt = () => render(<MemoryRouter><ConnectNumberPrompt /></MemoryRouter>);

beforeEach(() => {
  myNumbers.mockReset();
  navigate.mockReset();
  state.support = false;
  state.tours = { 'onboarding:welcome': true };
  sessionStorage.clear();
});

describe('ConnectNumberPrompt', () => {
  it('aparece com número nunca conectado', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [ok, fresh] });
    renderIt();
    expect(await screen.findByText('Conecte seu número')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp Ana está esperando você ler o QR code/)).toBeInTheDocument();
  });

  it('mostra "e mais N" quando há vários', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh, { ...fresh, inbox_id: 'i3', name: 'B' }] });
    renderIt();
    expect(await screen.findByText(/e mais 1 número/)).toBeInTheDocument();
  });

  it('some quando conectado ou never_connected false', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [ok, { ...fresh, connection: 'connected' }] });
    renderIt();
    await waitFor(() => expect(myNumbers).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText('Conecte seu número')).toBeNull();
  });

  it('não aparece para o suporte (e nem busca)', async () => {
    state.support = true;
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh] });
    renderIt();
    await Promise.resolve();
    expect(myNumbers).not.toHaveBeenCalled();
    expect(screen.queryByText('Conecte seu número')).toBeNull();
  });

  it('espera o tour de boas-vindas terminar', async () => {
    state.tours = {};
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh] });
    renderIt();
    await Promise.resolve();
    expect(screen.queryByText('Conecte seu número')).toBeNull();
  });

  it('"Depois" fecha e grava na sessão', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh] });
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }));
    expect(screen.queryByText('Conecte seu número')).toBeNull();
    expect(sessionStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('já dispensado na sessão: nem aparece', async () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh] });
    renderIt();
    await Promise.resolve();
    expect(screen.queryByText('Conecte seu número')).toBeNull();
  });

  it('"Conectar agora" leva para a configuração do número', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [fresh] });
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Conectar agora' }));
    expect(navigate).toHaveBeenCalledWith('/channels/i1/settings?tab=configuration&connect=1');
  });

  it('falha na busca: não renderiza nada', async () => {
    myNumbers.mockRejectedValue(new Error('boom'));
    const { container } = renderIt();
    await waitFor(() => expect(myNumbers).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.textContent).toBe('');
  });
});
