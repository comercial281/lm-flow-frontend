import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FollowupEnrollment } from './FollowupEnrollment';

const get = vi.fn();
const update = vi.fn();
const updateRouting = vi.fn();

vi.mock('@/services/followupEnrollment/followupEnrollmentService', () => ({
  followupEnrollmentService: {
    get: (...args: unknown[]) => get(...args),
    update: (...args: unknown[]) => update(...args),
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
  enabled: false,
  audience: 'paid',
  stage_id: null,
  routing: [],
  stages: [
    { id: 'stage-1', name: 'Contato', pipeline_id: 'p1', pipeline_name: 'Vendas' },
    { id: 'stage-2', name: 'Visita agendada', pipeline_id: 'p1', pipeline_name: 'Vendas' },
    { id: 'stage-3', name: 'Contato', pipeline_id: 'p2', pipeline_name: 'Locação' },
  ],
  sequence_slug: 'funil-a',
  sequences: [{ slug: 'funil-a', name: 'Funil A', steps_count: 3 }],
  audiences: [
    { value: 'paid', label: 'Só tráfego pago (anúncio)' },
    { value: 'all', label: 'Todos os leads' },
    { value: 'stage', label: 'Quando o card entra numa coluna' },
  ],
  managed_rule_id: null,
  external_active_rules: [],
  ...over,
});

describe('FollowupEnrollment — disparo por coluna', () => {
  beforeEach(() => {
    get.mockReset();
    update.mockReset();
    toastError.mockReset();
    get.mockResolvedValue(config());
    update.mockImplementation((payload) => Promise.resolve(config(payload as object)));
  });

  const turnOn = async (user: ReturnType<typeof userEvent.setup>) => {
    // A escolha de audiência fica sob `pointer-events-none` enquanto o painel está
    // desligado, então ligar vem primeiro — como na tela de verdade.
    await user.click(screen.getByRole('switch'));
  };

  it('só mostra a escolha de coluna quando a audiência é por coluna', async () => {
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    expect(screen.queryByLabelText('Coluna que inicia o funil')).not.toBeInTheDocument();

    await turnOn(user);
    await user.click(screen.getByRole('radio', { name: /entra numa coluna/i }));

    expect(await screen.findByLabelText('Coluna que inicia o funil')).toBeInTheDocument();
  });

  it('agrupa as colunas por pipeline — o mesmo nome existe em mais de um', async () => {
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await turnOn(user);
    await user.click(screen.getByRole('radio', { name: /entra numa coluna/i }));

    const select = await screen.findByLabelText('Coluna que inicia o funil');
    const groups = select.querySelectorAll('optgroup');

    expect([...groups].map(g => g.getAttribute('label'))).toEqual(['Vendas', 'Locação']);
    // Duas colunas "Contato" (uma por pipeline) precisam continuar distinguíveis.
    expect(select.querySelectorAll('option[value="stage-1"]')).toHaveLength(1);
    expect(select.querySelectorAll('option[value="stage-3"]')).toHaveLength(1);
  });

  it('recusa LIGAR sem escolher a coluna, e não chama o servidor', async () => {
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await turnOn(user);
    await user.click(screen.getByRole('radio', { name: /entra numa coluna/i }));
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(toastError).toHaveBeenCalledWith('Escolha a coluna que deve iniciar o funil');
    expect(update).not.toHaveBeenCalled();
  });

  it('manda a coluna escolhida ao ligar', async () => {
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await turnOn(user);
    await user.click(screen.getByRole('radio', { name: /entra numa coluna/i }));
    await user.selectOptions(await screen.findByLabelText('Coluna que inicia o funil'), 'stage-2');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({
      enabled: true,
      audience: 'stage',
      sequence_slug: 'funil-a',
      stage_id: 'stage-2',
    }));
  });

  // O ponto do teste: DESLIGAR não pode depender de a configuração estar completa.
  // Um painel que chegou meio preenchido (regra criada por fora, coluna apagada)
  // deixaria o usuário preso com o follow-up ligado e sem botão que obedeça.
  it('deixa DESLIGAR mesmo sem coluna escolhida', async () => {
    get.mockResolvedValue(config({ enabled: true, audience: 'stage', stage_id: null }));
    const user = userEvent.setup();
    render(<FollowupEnrollment />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await user.click(screen.getByRole('switch')); // liga -> desliga
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, audience: 'stage' }),
    ));
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
});
