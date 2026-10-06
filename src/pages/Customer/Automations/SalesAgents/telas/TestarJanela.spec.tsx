import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RehearsalOutcome, RehearsalResult, RehearsalState, RehearsalTurn, SalesAgent } from '@/services/salesAgents/salesAgentsService';

const rehearsal = vi.hoisted(() => vi.fn());
const testSend = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { rehearsal, testSend } }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));
import TestarJanela from './TestarJanela';

const agent = { id: 'ia-1', name: 'Sara · Lançamentos', lead_facing_name: 'Sara', model: 'claude-haiku-4-5-20251001', persona_kind: 'assistant', handoff_target: 'roleta', transfer_config: {} } as unknown as SalesAgent;

const estado = (extra: Partial<RehearsalState> = {}): RehearsalState => ({ v: 1, now: '2026-10-06T14:00:00-03:00', contact: {}, attrs: {}, labels: [], messages: [], lead_owner: null, source_conversation_id: null, ...extra });
const outcome = (extra: Partial<RehearsalOutcome> = {}): RehearsalOutcome => ({
  skipped: null, warnings: [], handoff: null, handoff_blocked: null, in_handoff: false, visit: null, collected: {}, checklist: [],
  temperature: null, stage: null, summary: null, labels: [], card: null, purpose: null, out_of_hours_notice: false, opening: null,
  model: null, test_model: null, agent_model: null, delay_s: null, notes: [], error: null, lead_owner: null, ...extra,
});
const resposta = (texto: string, s: RehearsalState, o = outcome()): RehearsalResult =>
  ({ state: s, turn: { kind: 'reply', at: s.now, messages: [{ content: texto, pause_ms: 0 }], reaction: null, note: null, media: [], outcome: o } });
const resultado = (turn: Partial<RehearsalTurn>, s: RehearsalState): RehearsalResult =>
  ({ state: s, turn: { kind: 'reply', at: s.now, messages: [], reaction: null, note: null, media: [], outcome: outcome(), ...turn } });

beforeEach(() => { rehearsal.mockReset(); testSend.mockReset(); toastError.mockReset(); localStorage.clear(); });

function abrir(a: SalesAgent = agent) {
  const aoFechar = vi.fn();
  const r = render(<><button>Testar</button><TestarJanela agent={a} aoFechar={aoFechar} /></>);
  return Object.assign(aoFechar, { r });
}

describe('TestarJanela', () => {
  it('é uma janela com nome, o celular com o nome que o lead vê e o selo TESTE', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: 'Testar a IA' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(screen.getByText('TESTE')).toBeInTheDocument();
  });

  it('devolve ao servidor o estado que recebeu e mostra o caminho, a temperatura e as perguntas', async () => {
    const a = estado({ caminho: 'Investimento' });
    rehearsal.mockResolvedValueOnce(resposta('É pra morar ou investir?', a, outcome({ temperature: 'hot', checklist: [{ pergunta: 'Renda', resposta: null, obrigatoria: true }] })))
      .mockResolvedValueOnce(resposta('Boa!', estado()));
    abrir();
    const campo = screen.getByLabelText('Mensagem do lead');
    await userEvent.type(campo, 'oi{Enter}');
    expect(await screen.findByText('É pra morar ou investir?')).toBeInTheDocument();
    expect(screen.getByText('Investimento')).toBeInTheDocument();
    expect(screen.getByText('Quente')).toBeInTheDocument();
    expect(screen.getByText('Renda')).toBeInTheDocument();
    await userEvent.type(campo, 'investir{Enter}');
    await screen.findByText('Boa!');
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: a, message: 'investir' });
  });

  it('avançar o tempo manda as horas do botão', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado()))
      .mockResolvedValueOnce({ state: estado(), turn: { kind: 'advance', at: '2026-10-06T23:00:00-03:00', messages: [], reaction: null, note: null, media: [], outcome: null, events: [], idle: 'Nada aconteceu' } });
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    await userEvent.click(screen.getByRole('button', { name: '+8 h' }));
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'advance', hours: 8 });
  });

  it('Esc e clique fora fecham', async () => {
    const aoFechar = abrir();
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('fundo-do-testar'));
    expect(aoFechar).toHaveBeenCalledTimes(2);
  });

  it('o foco fica preso dentro da janela', async () => {
    abrir();
    const janela = screen.getByRole('dialog', { name: 'Testar a IA' });
    for (let i = 0; i < 40; i += 1) {
      await userEvent.tab();
      expect(janela.contains(document.activeElement)).toBe(true);
    }
  });

  it('respeita "reduzir movimento": a animação tem o desligamento', () => {
    abrir();
    expect(screen.getByTestId('celular-do-testar').className).toMatch(/motion-reduce:animate-none/);
    expect(screen.getByTestId('fundo-do-testar').className).toMatch(/motion-reduce:animate-none/);
  });

  // ── Daqui pra baixo: os casos do TelaTestar.spec, trazidos pra janela ──

  it('abre com o foco no campo do lead e devolve o foco pra quem abriu ao fechar', () => {
    const testar = document.createElement('button');
    testar.textContent = 'Testar de fora';
    document.body.appendChild(testar);
    testar.focus();
    const { r } = abrir();
    expect(screen.getByLabelText('Mensagem do lead')).toHaveFocus();
    r.unmount();
    expect(testar).toHaveFocus();
    testar.remove();
  });

  it('Fechar fecha; Recomeçar limpa a conversa', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado()));
    const aoFechar = abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.queryByText('Oi!')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('sem o caminho no estado (servidor de antes da onda 2) o painel diz que ainda não escolheu', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado()));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    expect(screen.getByText('Ainda não escolheu.')).toBeInTheDocument();
  });

  it('uma bolha por mensagem da rajada, com o "digitando", e o que aconteceria com o card', async () => {
    rehearsal.mockResolvedValueOnce(resultado({
      messages: [{ content: 'Oi Camila!', pause_ms: 0 }, { content: 'Já te passo pro time.', pause_ms: 1200 }],
      outcome: outcome({
        handoff: { kind: 'roleta', destination: 'Roleta Zona Sul', reason: 'Pediu uma pessoa' },
        warnings: [{ reason: 'schedule_closed', text: 'Fora do horário de atendimento configurado' }],
        card: { stage: 'transferir', moves: true },
      }),
    }, estado()));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'quero falar com alguém{Enter}');
    await screen.findByText('Oi Camila!');
    expect(screen.getByText('Já te passo pro time.')).toBeInTheDocument();
    expect(screen.getByText('digitando 1,2 s')).toBeInTheDocument();
    const painel = screen.getByRole('complementary', { name: 'O que ela está fazendo' });
    expect(within(painel).getByText('Passaria pra Roleta Zona Sul agora')).toBeInTheDocument();
    expect(within(painel).getByText('Motivo pro corretor: Pediu uma pessoa')).toBeInTheDocument();
    expect(within(painel).getByText('Card: vai pra coluna de "Passou pro corretor"')).toBeInTheDocument();
    expect(within(painel).getByText(/No atendimento real: Fora do horário/)).toBeInTheDocument();
  });

  it('avançar o tempo mostra a retomada e mantém o painel do último turno', async () => {
    const a = estado();
    rehearsal
      .mockResolvedValueOnce(resposta('Pra morar?', a, outcome({ temperature: 'warm' })))
      .mockResolvedValueOnce(resultado({
        kind: 'advance', outcome: null, idle: null, notes: [],
        events: [{ kind: 'reengagement', at: '2026-10-06T16:00:20-03:00', attempt: 1, messages: [{ content: 'E aí, conseguiu ver?', pause_ms: 0 }], blank: false }],
      }, estado({ now: '2026-10-06T16:00:20-03:00' })));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Pra morar?');
    await userEvent.click(screen.getByRole('button', { name: 'Até ela agir sozinha' }));
    await screen.findByText('E aí, conseguiu ver?');
    expect(screen.getByText(/Retomada 1 de 2/)).toBeInTheDocument();
    expect(rehearsal.mock.calls[1][1]).toEqual({ step: 'advance', state: a, hours: null });
    expect(screen.getByText('Morna')).toBeInTheDocument();
  });

  it('avançar o tempo fica apagado antes da primeira mensagem', () => {
    abrir();
    expect(screen.getByRole('button', { name: '1 dia' })).toBeDisabled();
  });

  // Herdado do Testar antigo (fix de 30/09/26): o token das FOTOS só faz sentido no imóvel que o gerou.
  it('"Mandar pra mim" usa o imóvel do TURNO, não o do campo', async () => {
    rehearsal
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Fotos do AP1', pause_ms: 0 }], media: [{ type: 'photos', token: 'tok-ap1', urls: ['https://cdn/1.jpg'] }] }, estado()))
      .mockResolvedValueOnce(resultado({ messages: [{ content: 'Fotos do AP2', pause_ms: 0 }], media: [{ type: 'photos', token: 'tok-ap2', urls: ['https://cdn/2.jpg'] }] }, estado()));
    testSend.mockResolvedValue({ message: 'Mandado!' });
    abrir();
    const imovel = screen.getByLabelText('Imóvel');
    const campo = screen.getByLabelText('Mensagem do lead');
    await userEvent.type(imovel, 'AP1');
    await userEvent.type(campo, 'me manda as fotos{Enter}');
    await screen.findByText('Fotos do AP1');
    await userEvent.clear(imovel);
    await userEvent.type(imovel, 'AP2');
    await userEvent.type(campo, 'e as do AP2?{Enter}');
    await screen.findByText('Fotos do AP2');
    await userEvent.click(screen.getAllByRole('button', { name: /mandar pra mim/i })[0]);
    await userEvent.type(screen.getByPlaceholderText('Seu WhatsApp (com DDD)'), '11999998888{Enter}');
    await waitFor(() => expect(testSend).toHaveBeenCalledWith('ia-1', { phone: '11999998888', token: 'tok-ap1', property_code: 'AP1' }));
  });

  it('os 6 cenários prontos; escolher um mostra a frase dele e manda o histórico como semente', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Que bom que voltou!', estado()));
    abrir();
    const seletor = screen.getByLabelText('Cenário');
    for (const nome of ['Veio do anúncio', 'Formulário do Meta', 'Já visitou', 'Conversa em andamento', 'Sumiu e voltou', 'Pede uma pessoa']) {
      expect(within(seletor).getByRole('option', { name: nome })).toBeInTheDocument();
    }
    await userEvent.selectOptions(seletor, 'Sumiu e voltou');
    expect(screen.getByText('Parou de responder 3 dias atrás e voltou: retoma sem recomeçar.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do lead')).toHaveValue('Juliana');
    expect(screen.getByText('quero saber do apartamento de 2 quartos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Que bom que voltou!');
    expect(rehearsal.mock.calls[0][1]).toMatchObject({
      step: 'turn', state: null, message: 'oi, desculpa a demora, é pra morar',
      seed: { hours_ago: 72, history: [{ role: 'user', content: 'quero saber do apartamento de 2 quartos' }, { role: 'assistant', content: 'Boa! É pra morar ou investir?' }] },
    });
  });

  it('cenário SUBSTITUI o teste: a conversa anterior some e o próximo turno começa do zero', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado())).mockResolvedValueOnce(resposta('Olá Camila', estado()));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    await userEvent.selectOptions(screen.getByLabelText('Cenário'), 'Veio do anúncio');
    expect(screen.queryByText('Oi!')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Olá Camila');
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: null, message: 'oi, vi o anúncio' });
  });

  it('salvar o cenário pede um nome, guarda no navegador e ele aparece na lista; remover tira', async () => {
    abrir();
    await userEvent.type(screen.getByLabelText('Nome do lead'), ' Silva');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar este cenário' }));
    await userEvent.type(await screen.findByLabelText('Nome do cenário'), 'Lead frio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar cenário' }));
    const seletor = screen.getByLabelText('Cenário');
    await waitFor(() => expect(within(seletor).getByRole('option', { name: 'Lead frio' })).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('lmflow:sales-agent-test-scenarios') ?? '[]')).toMatchObject([{ id: 'custom-lead-frio', contactName: 'Lead Teste Silva' }]);

    await userEvent.selectOptions(seletor, 'Lead frio');
    await userEvent.click(screen.getByRole('button', { name: 'Remover este cenário' }));
    expect(within(seletor).queryByRole('option', { name: 'Lead frio' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('lmflow:sales-agent-test-scenarios') ?? '[]')).toEqual([]);
  });

  it('os cenários prontos não têm "Remover"', async () => {
    abrir();
    await userEvent.selectOptions(screen.getByLabelText('Cenário'), 'Veio do anúncio');
    expect(screen.queryByRole('button', { name: 'Remover este cenário' })).not.toBeInTheDocument();
  });

  it('Esc com a pergunta do "Salvar este cenário" aberta fecha só a pergunta', async () => {
    const aoFechar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar este cenário' }));
    await screen.findByLabelText('Nome do cenário');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByLabelText('Nome do cenário')).not.toBeInTheDocument());
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('usar a conversa de um lead real só pede o telefone e só lê', async () => {
    const carregado = estado({ messages: [{ id: 'm1', role: 'user', content: 'oi, é do anúncio?', at: '2026-10-06T13:00:00-03:00', marks: {} }] });
    rehearsal.mockResolvedValueOnce(resultado({ kind: 'loaded', outcome: outcome({ opening: 'Campanha Vivaz' }) }, carregado));
    abrir();
    expect(screen.queryByLabelText('Telefone com DDD')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar a conversa de um lead real' }));
    await userEvent.type(screen.getByLabelText('Telefone com DDD'), '(11) 99999-8888');
    await userEvent.click(screen.getByRole('button', { name: 'Carregar' }));
    await screen.findByText('oi, é do anúncio?');
    expect(rehearsal).toHaveBeenCalledWith('ia-1', { step: 'load', phone: '11999998888' });
    expect(screen.getByText('Abertura usada: Campanha Vivaz')).toBeInTheDocument();
    expect(screen.getByText('Até aqui é a conversa real. Daqui pra frente é teste.')).toBeInTheDocument();
  });

  // O imóvel do lead real vem junto: com o campo vazio, o turno seguinte mandaria property_code '' e o servidor apagaria o imóvel.
  it('carregar traz o imóvel do lead e o turno seguinte manda o mesmo', async () => {
    const carregado = estado({ attrs: { sales_agent_property_code: 'AP9' }, messages: [{ id: 'm1', role: 'user', content: 'oi', at: '2026-10-06T13:00:00-03:00', marks: {} }] });
    rehearsal.mockResolvedValueOnce(resultado({ kind: 'loaded', outcome: outcome() }, carregado))
      .mockResolvedValueOnce(resposta('Olá!', estado()));
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Usar a conversa de um lead real' }));
    await userEvent.type(screen.getByLabelText('Telefone com DDD'), '11999998888');
    await userEvent.click(screen.getByRole('button', { name: 'Carregar' }));
    await screen.findByText('oi');
    expect(screen.getByLabelText('Imóvel')).toHaveValue('AP9');
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'tem vaga?{Enter}');
    await screen.findByText('Olá!');
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: carregado, context: { property_code: 'AP9' } });
  });

  it('diz em que modelo o teste roda e avisa quando a IA atende em outro', () => {
    abrir({ ...agent, model: 'claude-sonnet-4-5', test_model: 'claude-haiku-4-5' } as unknown as SalesAgent);
    expect(screen.getByText(/Teste no Haiku/)).toBeInTheDocument();
    expect(screen.getByText(/Esta IA atende no Sonnet; o teste usa o Haiku/)).toBeInTheDocument();
  });

  it('erro do servidor aparece com a frase dele e a mensagem volta pro campo', async () => {
    rehearsal.mockRejectedValueOnce(new Error('Limite de 60 testes por hora nesta IA. Libera às 15:00.'));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Limite de 60 testes por hora nesta IA. Libera às 15:00.'));
    expect(screen.getByLabelText('Mensagem do lead')).toHaveValue('oi');
  });

  it('o nome do celular cai pro nome da IA quando não há nome pro lead', () => {
    abrir({ ...agent, lead_facing_name: null } as unknown as SalesAgent);
    expect(screen.getByText('Sara · Lançamentos')).toBeInTheDocument();
  });
});
