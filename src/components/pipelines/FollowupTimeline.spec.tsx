import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowupTimeline from './FollowupTimeline';

const get = vi.fn();
const start = vi.fn();
const pause = vi.fn();
const resume = vi.fn();
const stop = vi.fn();

vi.mock('@/services/leadFollowup/leadFollowupService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/leadFollowup/leadFollowupService',
  );
  return {
    ...actual,
    leadFollowupService: {
      get: (...a: unknown[]) => get(...a),
      start: (...a: unknown[]) => start(...a),
      pause: (...a: unknown[]) => pause(...a),
      resume: (...a: unknown[]) => resume(...a),
      stop: (...a: unknown[]) => stop(...a),
    },
  };
});

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

/**
 * O bloco de Follow-up do card mostrava "Ativar follow-up" — desligado — num
 * lead com mensagens já agendadas: o botão lia a etiqueta `follow-up` da
 * conversa e a lista lia a fila. Estes exemplos travam a correção: o estado
 * exibido vem da FILA, e botão que aparece é botão que o servidor aceita.
 */
describe('Follow-up do card — o estado vem da fila', () => {
  beforeEach(() => {
    [get, start, pause, resume, stop].forEach(m => m.mockReset());
  });

  it('mostra RODANDO com a fila cheia, sem depender de etiqueta nenhuma', async () => {
    get.mockResolvedValue({
      jobs: [job({ status: 'sent', executed_at: 1_755_000_000 }), job()],
      state: state({
        status: 'running', queued_count: 7, sent_count: 1, total_steps: 8,
        sequence: { id: '1', slug: 'pos-visita', name: 'Pós-visita' },
        can_pause: true, can_stop: true,
      }),
    });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText('Rodando')).toBeInTheDocument();
    expect(screen.getByText('Pós-visita')).toBeInTheDocument();
    expect(screen.getByText('1 de 8 mensagens')).toBeInTheDocument();
    // O botão de ligar não aparece com follow-up vivo: ele cancelaria a fila e
    // reagendaria tudo, que é a surpresa que ninguém pediu.
    expect(screen.queryByRole('button', { name: /Iniciar follow-up/ })).not.toBeInTheDocument();
  });

  // Pausar era decorativo: punha a etiqueta `follow-up-pausado` na conversa, que
  // nenhum ponto do envio lia. Agora é uma ação de verdade contra o servidor.
  it('Pausar chama o servidor e recarrega a lista da mesma fonte', async () => {
    get.mockResolvedValue({
      jobs: [job()],
      state: state({ status: 'running', queued_count: 1, can_pause: true, can_stop: true }),
    });
    pause.mockResolvedValue({ state: state({ status: 'paused' }), message: 'Follow-up pausado' });

    render(<FollowupTimeline contactId="c-1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Pausar/ }));

    await waitFor(() => expect(pause).toHaveBeenCalledWith({ contactId: 'c-1', conversationId: undefined }));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('só oferece os botões que o servidor aceita', async () => {
    get.mockResolvedValue({
      jobs: [job({ status: 'paused' })],
      state: state({ status: 'paused', queued_count: 1, can_resume: true, can_stop: true }),
    });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByRole('button', { name: /Retomar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pausar/ })).not.toBeInTheDocument();
  });

  // 403 é cargo sem permissão. Mostrar "nenhuma mensagem" no lugar foi o que fez
  // a linha do tempo parecer vazia pra corretor e gestor, com a fila cheia.
  it('diz que é falta de acesso quando o servidor recusa, em vez de fingir lista vazia', async () => {
    get.mockRejectedValue({ response: { status: 403 } });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText(/não dá acesso ao follow-up/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma mensagem de follow-up/i)).not.toBeInTheDocument();
  });

  // O texto do funil tem variáveis dentro; cru, o card mostrava `Oi {{nome}}`.
  it('mostra a prévia com o nome do lead no lugar da variável', async () => {
    get.mockResolvedValue({ jobs: [job()], state: state({ status: 'running', can_stop: true }) });

    render(<FollowupTimeline contactId="c-1" leadName="Maria Silva" />);

    expect(await screen.findByText('Oi Maria, tudo bem?')).toBeInTheDocument();
  });

  it('esconde os passos cancelados atrás de um contador, sem sumir com eles', async () => {
    get.mockResolvedValue({
      jobs: [job({ status: 'cancelled' }), job({ status: 'sent', executed_at: 1_755_000_000 })],
      state: state({ status: 'done', sent_count: 1, total_steps: 1 }),
    });

    render(<FollowupTimeline contactId="c-1" />);

    expect(await screen.findByText('1 cancelado(s)')).toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('1 cancelado(s)'));
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });

  it('não pede nada ao servidor quando o card não tem nem contato nem conversa', async () => {
    render(<FollowupTimeline contactId={null} conversationId={null} />);

    await waitFor(() => expect(screen.getByText('Sem follow-up')).toBeInTheDocument());
    expect(get).not.toHaveBeenCalled();
  });
});
