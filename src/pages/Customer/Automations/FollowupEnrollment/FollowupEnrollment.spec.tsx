import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FollowupEnrollment } from './FollowupEnrollment';

const get = vi.fn();
const updateRouting = vi.fn();

vi.mock('@/services/followupEnrollment/followupEnrollmentService', () => ({
  followupEnrollmentService: {
    get: (...args: unknown[]) => get(...args),
    updateRouting: (...args: unknown[]) => updateRouting(...args),
  },
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const config = (over: Record<string, unknown> = {}) => ({
  routing: [],
  sequences: [{ slug: 'funil-a', name: 'Funil A', steps_count: 3 }],
  external_active_rules: [],
  ...over,
});

// O painel global de disparo (chave "Ativar follow-up automático" + "Quais leads
// entram" + escolha de coluna) SAIU: cada funil passou a ter as próprias portas
// de entrada, em "Quando este funil começa". Estes exemplos travam a remoção —
// se o painel voltar, voltam também os dois donos brigando pelo mesmo disparo.
describe('FollowupEnrollment — o painel global saiu', () => {
  beforeEach(() => {
    get.mockReset();
    toastError.mockReset();
    get.mockResolvedValue(config());
  });

  it('não mostra mais a chave de ligar follow-up automático', async () => {
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('não mostra mais a escolha de coluna nem a de audiência', async () => {
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(screen.queryByLabelText('Coluna que inicia o funil')).not.toBeInTheDocument();
    expect(screen.queryByText('Quais leads entram')).not.toBeInTheDocument();
  });
});

describe('FollowupEnrollment — destino por origem', () => {
  const withRouting = (over: Record<string, unknown> = {}) => config({
    routing: [
      { key: 'paid', label: 'Veio de anúncio (tráfego pago)', sequence_slug: 'funil-a', enabled: true, exists: true },
      { key: 'organic', label: 'Veio do orgânico ou de palavra-chave', sequence_slug: null, enabled: false, exists: false },
    ],
    sequences: [
      { slug: 'funil-a', name: 'Funil A', steps_count: 3 },
      { slug: 'funil-b', name: 'Funil B', steps_count: 2 },
    ],
    ...over,
  });

  beforeEach(() => {
    get.mockReset();
    updateRouting.mockReset();
    toastError.mockReset();
    get.mockResolvedValue(withRouting());
    updateRouting.mockImplementation(() => Promise.resolve({ config: withRouting(), missingRules: [] }));
  });

  it('mostra o funil já escolhido para cada origem', async () => {
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(await screen.findByLabelText('Veio de anúncio (tráfego pago)')).toHaveValue('funil-a');
  });

  // Sem a regra não há onde gravar a escolha; oferecer o campo seria mentir.
  it('desabilita a origem cuja regra não existe neste CRM', async () => {
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(await screen.findByLabelText(/orgânico/i)).toBeDisabled();
    expect(screen.getByText(/não tem a regra de origem/i)).toBeInTheDocument();
  });

  it('manda só a origem alterada', async () => {
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await user.selectOptions(await screen.findByLabelText('Veio de anúncio (tráfego pago)'), 'funil-b');
    await user.click(screen.getByRole('button', { name: /destino por origem/i }));

    await waitFor(() => expect(updateRouting).toHaveBeenCalledWith({ paid: 'funil-b' }));
  });

  // O texto precisa dizer que isto vale só pra entrada manual — senão volta a
  // dúvida de qual lugar manda no disparo, que é o problema que a mudança resolve.
  it('diz que o disparo automático mora dentro de cada funil', async () => {
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(await screen.findByText(/Quando este funil começa/i)).toBeInTheDocument();
  });
});
