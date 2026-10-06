import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rehearsal = vi.hoisted(() => vi.fn());
const testSend = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { rehearsal, testSend },
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));

import { TelaTestar } from './TelaTestar';
import type {
  RehearsalOutcome, RehearsalResult, RehearsalState, RehearsalTurn, SalesAgent,
} from '@/services/salesAgents/salesAgentsService';

const agent = { id: 'agent-1' } as unknown as SalesAgent;

function estado(n: number): RehearsalState {
  return { v: 1, now: `2026-10-05T14:0${n}:00-03:00`, contact: {}, attrs: {}, labels: [], messages: [], lead_owner: null, source_conversation_id: null };
}

function outcome(extra: Partial<RehearsalOutcome> = {}): RehearsalOutcome {
  return {
    skipped: null, warnings: [], handoff: null, handoff_blocked: null, in_handoff: false, visit: null,
    collected: {}, checklist: [], temperature: null, stage: null, summary: null, labels: [], card: null,
    purpose: null, out_of_hours_notice: false, opening: null, model: null, test_model: null, agent_model: null,
    delay_s: null, notes: [],
    error: null, lead_owner: null, ...extra,
  };
}

function resultado(turn: Partial<RehearsalTurn>, state: RehearsalState): RehearsalResult {
  return {
    state,
    turn: { kind: 'reply', at: state.now, messages: [], reaction: null, note: null, media: [], outcome: outcome(), ...turn },
  };
}

beforeEach(() => {
  rehearsal.mockReset();
  testSend.mockReset();
  toastError.mockReset();
  localStorage.clear();
});

describe('TelaTestar — Testar fiel', () => {
  it('devolve ao servidor o estado que recebeu, a cada turno', async () => {
    const user = userEvent.setup();
    const a = estado(1);
    rehearsal
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Oi! Pra morar?', pause_ms: 0 }] }, a))
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Boa!', pause_ms: 0 }] }, estado(2)));

    render(<TelaTestar agent={agent} />);
    const campo = screen.getByPlaceholderText('Mensagem do lead...');
    await user.type(campo, 'oi{Enter}');
    await screen.findByText('Oi! Pra morar?');
    await user.type(campo, 'sim{Enter}');
    await screen.findByText('Boa!');

    expect(rehearsal.mock.calls[0][1]).toMatchObject({ step: 'turn', state: null, message: 'oi' });
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: a, message: 'sim' });
  });

  it('uma bolha por mensagem da rajada, com o "digitando", e o que aconteceria', async () => {
    const user = userEvent.setup();
    rehearsal.mockResolvedValueOnce(resultado({
      messages: [{ content: 'Oi Camila!', pause_ms: 0 }, { content: 'Já te passo pro time.', pause_ms: 1200 }],
      outcome: outcome({
        handoff: { kind: 'roleta', destination: 'Roleta Zona Sul' },
        warnings: [{ reason: 'schedule_closed', text: 'Fora do horário de atendimento configurado' }],
      }),
    }, estado(1)));

    render(<TelaTestar agent={agent} />);
    await user.type(screen.getByPlaceholderText('Mensagem do lead...'), 'quero falar com alguém{Enter}');

    await screen.findByText('Oi Camila!');
    expect(screen.getByText('Já te passo pro time.')).toBeInTheDocument();
    expect(screen.getByText('digitando 1,2 s')).toBeInTheDocument();
    expect(screen.getByText('Passaria pra Roleta Zona Sul agora')).toBeInTheDocument();
    expect(screen.getByText(/No atendimento real: Fora do horário/)).toBeInTheDocument();
  });

  it('avançar o tempo manda as horas escolhidas e mostra a retomada', async () => {
    const user = userEvent.setup();
    const a = estado(1);
    rehearsal
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Pra morar?', pause_ms: 0 }] }, a))
      .mockResolvedValueOnce(resultado({
        kind: 'advance', outcome: null, idle: null, notes: [],
        events: [{ kind: 'reengagement', at: '2026-10-05T16:00:20-03:00', attempt: 1, messages: [{ content: 'E aí, conseguiu ver?', pause_ms: 0 }], blank: false }],
      }, estado(2)));

    render(<TelaTestar agent={agent} />);
    await user.type(screen.getByPlaceholderText('Mensagem do lead...'), 'oi{Enter}');
    await screen.findByText('Pra morar?');
    await user.selectOptions(screen.getByLabelText('Quanto avançar'), '2 horas');
    await user.click(screen.getByRole('button', { name: 'Avançar o tempo' }));

    await screen.findByText('E aí, conseguiu ver?');
    expect(screen.getByText(/Retomada 1 de 2/)).toBeInTheDocument();
    expect(rehearsal.mock.calls[1][1]).toEqual({ step: 'advance', state: a, hours: 2 });
  });

  // Herdado do Testar antigo (fix de 30/09/26): o token das FOTOS só faz sentido no
  // imóvel que o gerou.
  it('"Mandar pra mim" usa o imóvel do TURNO, não o do campo', async () => {
    const user = userEvent.setup();
    rehearsal
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Fotos do AP1', pause_ms: 0 }], media: [{ type: 'photos', token: 'tok-ap1', urls: ['https://cdn/1.jpg'] }] }, estado(1)))
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Fotos do AP2', pause_ms: 0 }], media: [{ type: 'photos', token: 'tok-ap2', urls: ['https://cdn/2.jpg'] }] }, estado(2)));
    testSend.mockResolvedValue({ message: 'Mandado!' });

    render(<TelaTestar agent={agent} />);
    await user.click(screen.getByText('Ajustar o teste'));
    const imovel = screen.getByPlaceholderText('Código do imóvel (ex: AP123)') as HTMLInputElement;
    const campo = screen.getByPlaceholderText('Mensagem do lead...');

    await user.type(imovel, 'AP1');
    await user.type(campo, 'me manda as fotos{Enter}');
    await screen.findByText('Fotos do AP1');
    await user.clear(imovel);
    await user.type(imovel, 'AP2');
    await user.type(campo, 'e as do AP2?{Enter}');
    await screen.findByText('Fotos do AP2');

    await user.click(screen.getAllByRole('button', { name: /mandar pra mim/i })[0]);
    await user.type(screen.getByPlaceholderText('Seu WhatsApp (com DDD)'), '11999998888{Enter}');

    await waitFor(() => expect(testSend).toHaveBeenCalledWith('agent-1', {
      phone: '11999998888', token: 'tok-ap1', property_code: 'AP1',
    }));
  });

  it('cenário mostra o subtítulo sem passar o mouse e manda o histórico como semente', async () => {
    const user = userEvent.setup();
    rehearsal.mockResolvedValueOnce(resultado({ messages: [{ content: 'Que bom que voltou!', pause_ms: 0 }] }, estado(1)));

    render(<TelaTestar agent={agent} />);
    expect(screen.getByText('Parou de responder 3 dias atrás e voltou: retoma sem recomeçar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sumiu e voltou/ }));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await screen.findByText('Que bom que voltou!');
    expect(rehearsal.mock.calls[0][1]).toMatchObject({
      step: 'turn', state: null, message: 'oi, desculpa a demora, é pra morar',
      seed: { hours_ago: 72, history: [{ role: 'user', content: 'quero saber do apartamento de 2 quartos' }, { role: 'assistant', content: 'Boa! É pra morar ou investir?' }] },
    });
  });

  it('carregar conversa real só pede telefone', async () => {
    const user = userEvent.setup();
    const carregado: RehearsalState = { ...estado(1), messages: [{ id: 'm1', role: 'user', content: 'oi, é do anúncio?', at: '2026-10-05T13:00:00-03:00', marks: {} }] };
    rehearsal.mockResolvedValueOnce(resultado({ kind: 'loaded', outcome: outcome({ opening: 'Campanha Vivaz' }) }, carregado));

    render(<TelaTestar agent={agent} />);
    await user.type(screen.getByPlaceholderText('Telefone com DDD'), '(11) 99999-8888');
    await user.click(screen.getByRole('button', { name: 'Carregar' }));

    await screen.findByText('oi, é do anúncio?');
    expect(rehearsal).toHaveBeenCalledWith('agent-1', { step: 'load', phone: '11999998888' });
    expect(screen.getByText('Abertura usada: Campanha Vivaz')).toBeInTheDocument();
  });

  it('diz em que modelo o teste roda e avisa quando a IA atende em outro', () => {
    const sonnet = { id: 'agent-1', model: 'claude-sonnet-4-5', test_model: 'claude-haiku-4-5' } as unknown as SalesAgent;

    render(<TelaTestar agent={sonnet} />);

    expect(screen.getByText('Teste no Haiku')).toBeInTheDocument();
    expect(screen.getByText('Esta IA atende no Sonnet; o teste usa o Haiku')).toBeInTheDocument();
  });

  it('erro do servidor aparece com a frase dele', async () => {
    const user = userEvent.setup();
    rehearsal.mockRejectedValueOnce(new Error('Limite de 60 testes por hora nesta IA. Libera às 15:00.'));

    render(<TelaTestar agent={agent} />);
    await user.type(screen.getByPlaceholderText('Mensagem do lead...'), 'oi{Enter}');

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Limite de 60 testes por hora nesta IA. Libera às 15:00.'));
  });
});
