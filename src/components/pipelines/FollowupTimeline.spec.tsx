import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowupTimeline from './FollowupTimeline';

const get = vi.fn();
const legacyStop = vi.fn();
const running = vi.fn();
const instanceStart = vi.fn();
const instanceStop = vi.fn();
// Os follow-ups que dá pra iniciar vêm na mesma leitura (meta.startable_followups).
let startable: Array<{ id: string; name: string }> = [];

vi.mock('@/services/leadFollowup/leadFollowupService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/leadFollowup/leadFollowupService',
  );
  return {
    ...actual,
    leadFollowupService: {
      get: (...a: unknown[]) => get(...a),
      stop: (...a: unknown[]) => legacyStop(...a),
    },
  };
});

vi.mock('@/services/flowAutomations/flowAutomationInstancesService', () => ({
  flowAutomationInstancesService: {
    forCard: async (...a: unknown[]) => ({ flows: await running(...a), startable }),
    start: (...a: unknown[]) => instanceStart(...a),
    stop: (...a: unknown[]) => instanceStop(...a),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const state = (over: Record<string, unknown> = {}) => ({
  status: 'idle',
  sequence: null,
  queued_count: 0,
  sent_count: 0,
  total_steps: null,
  next_run_at: null,
  last_sent_at: null,
  can_pause: false,
  can_resume: false,
  can_stop: false,
  sequences: [],
  ...over,
});

const job = (over: Record<string, unknown> = {}) => ({
  id: Math.random().toString(36).slice(2),
  status: 'pending',
  run_at: 1_756_000_000,
  executed_at: null,
  last_error: null,
  step: { id: 's', position: 1, content: 'Oi {{nome}}, tudo bem?' },
  sequence: { name: 'Pós-visita', slug: 'pos-visita' },
  ...over,
});

const instance = (over: Record<string, unknown> = {}) => ({
  id: 'i1', flow_automation_id: 'f1', flow_name: 'Follow-up longo', state: 'waiting', active: true,
  phase: 'waiting_reply', until: null, started_at: null, kind: 'followup', ...over,
});

const flow = (over: Record<string, unknown> = {}) => ({ id: 'f1', name: 'Follow-up longo', ...over });

beforeEach(() => {
  [get, legacyStop, running, instanceStart, instanceStop].forEach(m => m.mockReset());
  get.mockResolvedValue({ jobs: [], state: state() });
  running.mockResolvedValue([]);
  startable = [];
});

/**
 * Sprint 3 (03/10/2026): o follow-up é um fluxo do construtor. O card mostra o
 * fluxo de follow-up rodando com a mesma linha da faixa da conversa, e só
 * Iniciar e Parar (Pausar/Retomar saíram).
 */
describe('Follow-up do card — fluxo de follow-up', () => {
  it('mostra o follow-up rodando com a fase atual e para pela instância', async () => {
    running.mockResolvedValue([instance()]);
    instanceStop.mockResolvedValue({ message: 'Fluxo parado' });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText('Rodando')).toBeInTheDocument();
    expect(screen.getByText('Follow-up "Follow-up longo" · aguardando resposta, sem limite')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pausar/ })).not.toBeInTheDocument();
    // Com follow-up rodando não se inicia outro por cima.
    expect(screen.queryByRole('button', { name: /Iniciar follow-up/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Parar o follow-up/ }));
    await waitFor(() => expect(instanceStop).toHaveBeenCalledWith('i1'));
    expect(running).toHaveBeenCalledTimes(2);
  });

  it('fluxo comum (automação) não aparece no bloco de follow-up', async () => {
    running.mockResolvedValue([instance({ kind: 'automation', flow_name: 'Boas-vindas' })]);

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText('Sem follow-up')).toBeInTheDocument();
    expect(screen.queryByText(/Boas-vindas/)).not.toBeInTheDocument();
  });

  it('sem nada rodando, Iniciar escolhe um dos follow-ups que o servidor lista', async () => {
    startable = [flow(), flow({ id: 'f2', name: 'Follow-up curto' })];
    instanceStart.mockResolvedValue({ message: 'Follow-up iniciado' });

    render(<FollowupTimeline contactId="c-1" />);

    const seletor = await screen.findByLabelText('Qual follow-up');
    expect(screen.getByRole('option', { name: 'Follow-up curto' })).toBeInTheDocument();
    const iniciar = screen.getByRole('button', { name: /Iniciar follow-up/ });
    expect(iniciar).toBeDisabled();

    fireEvent.change(seletor, { target: { value: 'f2' } });
    await userEvent.click(iniciar);

    await waitFor(() => expect(instanceStart).toHaveBeenCalledWith({ contactId: 'c-1', conversationId: undefined }, 'f2'));
  });

  it('com um follow-up só, o botão já inicia ele', async () => {
    startable = [flow()];
    instanceStart.mockResolvedValue({});

    render(<FollowupTimeline contactId="c-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Iniciar follow-up/ })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /Iniciar follow-up/ }));
    await waitFor(() => expect(instanceStart).toHaveBeenCalledWith(expect.anything(), 'f1'));
  });

  it('sem follow-up ligado, diz onde criar', async () => {
    render(<FollowupTimeline contactId="c-1" />);
    expect(await screen.findByText(/Nenhum follow-up pra iniciar/)).toBeInTheDocument();
  });

  it('somente leitura: nem Iniciar nem Parar', async () => {
    running.mockResolvedValue([instance()]);
    startable = [flow()];
    render(<FollowupTimeline contactId="c-1" readOnly />);
    expect(await screen.findByText('Rodando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar/ })).not.toBeInTheDocument();
  });

  it('com follow-up rodando, a lista do Iniciar não aparece mesmo vindo do servidor', async () => {
    running.mockResolvedValue([instance()]);
    startable = [flow()];
    render(<FollowupTimeline contactId="c-1" />);
    expect(await screen.findByText('Rodando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar/ })).not.toBeInTheDocument();
  });
});

/**
 * Quem já estava na fila de um funil antigo termina nele. O card mostra essa
 * fila (formato antigo), com Parar e a linha do tempo, sem Pausar/Retomar.
 */
describe('Follow-up do card — formato antigo terminando', () => {
  it('mostra a fila antiga só com Parar', async () => {
    get.mockResolvedValue({
      jobs: [job({ status: 'sent', executed_at: 1_755_000_000 }), job()],
      state: state({
        status: 'running', queued_count: 7, sent_count: 1, total_steps: 8,
        sequence: { id: '1', slug: 'pos-visita', name: 'Pós-visita' },
        can_pause: true, can_stop: true,
      }),
    });
    legacyStop.mockResolvedValue({ state: state(), message: 'Follow-up parado' });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText('Rodando')).toBeInTheDocument();
    expect(screen.getByText(/Follow-up "Pós-visita"/)).toBeInTheDocument();
    expect(screen.getByText(/formato antigo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pausar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retomar/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Parar o follow-up do formato antigo' }));
    await waitFor(() => expect(legacyStop).toHaveBeenCalledWith({ contactId: 'c-1', conversationId: undefined }));
  });

  it('"Ver mensagens" abre a linha do tempo antiga com o nome do lead', async () => {
    get.mockResolvedValue({
      jobs: [job(), job({ status: 'cancelled' })],
      state: state({ status: 'running', queued_count: 1, can_stop: true }),
    });

    render(<FollowupTimeline contactId="c-1" leadName="Ana Souza" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ver mensagens' }));
    expect(await screen.findByText('Linha do tempo')).toBeInTheDocument();
    expect(screen.getByText('Oi Ana, tudo bem?')).toBeInTheDocument();
    expect(screen.getByText('1 cancelado')).toBeInTheDocument();
  });
});

describe('Follow-up do card — acesso e lead sem referência', () => {
  // 403 é cargo sem permissão. Mostrar "Sem follow-up" no lugar foi o que fez a
  // linha do tempo parecer vazia pra corretor e gestor, com a fila cheia.
  it('diz que é falta de acesso quando o servidor recusa', async () => {
    get.mockRejectedValue({ response: { status: 403 } });
    running.mockRejectedValue({ response: { status: 403 } });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText(/não dá acesso ao follow-up/i)).toBeInTheDocument();
  });

  it('não pede nada ao servidor quando o card não tem nem contato nem conversa', async () => {
    render(<FollowupTimeline contactId={null} conversationId={null} />);

    await waitFor(() => expect(screen.getByText('Sem follow-up')).toBeInTheDocument());
    expect(get).not.toHaveBeenCalled();
    expect(running).not.toHaveBeenCalled();
  });
});
