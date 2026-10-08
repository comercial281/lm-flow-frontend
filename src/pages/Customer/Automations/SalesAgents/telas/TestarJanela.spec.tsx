import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RehearsalOutcome, RehearsalResult, RehearsalState, RehearsalTurn, SalesAgent } from '@/services/salesAgents/salesAgentsService';

const rehearsal = vi.hoisted(() => vi.fn());
const rehearsalForms = vi.hoisted(() => vi.fn());
const testSend = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { rehearsal, rehearsalForms, testSend } }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));
import { useAuthStore } from '@/store/authStore';
import type { UserResponse } from '@/types/auth/auth';
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

beforeEach(() => {
  rehearsal.mockReset(); rehearsalForms.mockReset(); testSend.mockReset(); toastError.mockReset(); localStorage.clear();
  useAuthStore.setState({ currentUser: { id: 'u1', email: 'tony@x.com', name: 'Tony Marques' } as UserResponse });
});

// ritmo 0: as bolhas chegam na mesma ordem, sem as esperas da animação.
function abrir(a: SalesAgent = agent) {
  const aoFechar = vi.fn();
  const r = render(<><button>Testar</button><TestarJanela agent={a} aoFechar={aoFechar} ritmo={0} /></>);
  return Object.assign(aoFechar, { r });
}

const cenario = (nome: string) => userEvent.click(screen.getByRole('radio', { name: new RegExp(`^${nome}`) }));

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

  // Revisão final da onda 3 (I3): depois de fechada, a janela não fica ouvindo o
  // teclado nem trava a rolagem da página de trás.
  it('depois de fechada, o Esc não chama mais nada e a página volta a rolar', () => {
    document.body.style.overflow = 'scroll';
    const aoFechar = abrir();
    expect(document.body.style.overflow).toBe('hidden');
    aoFechar.r.unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(aoFechar).not.toHaveBeenCalled();
    document.body.style.overflow = '';
  });

  it('o erro de um turno que volta depois de a janela fechar não aparece', async () => {
    let falhar: (e: Error) => void = () => {};
    rehearsal.mockReturnValueOnce(new Promise((_, rej) => { falhar = rej; }));
    const aoFechar = abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    aoFechar.r.unmount();
    falhar(new Error('Tempo esgotado'));
    await new Promise((r) => setTimeout(r, 0));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('Recomeçar com um cenário escolhido recomeça O MESMO cenário (a frase não mente)', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Que bom que voltou!', estado())).mockResolvedValueOnce(resposta('De novo', estado()));
    abrir();
    await cenario('Sumiu e voltou');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Que bom que voltou!');
    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.queryByText('Que bom que voltou!')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Sumiu e voltou/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('quero saber do apartamento de 2 quartos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('De novo');
    // O turno de depois do Recomeçar roda o cenário de novo (com a semente), não conversa livre.
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: null, message: 'oi, desculpa a demora, é pra morar', seed: { hours_ago: 72 } });
  });

  it('duas perguntas iguais no painel não quebram a lista', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repetida = { pergunta: 'Renda', resposta: null, obrigatoria: true };
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado(), outcome({ checklist: [repetida, repetida] })));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    expect(screen.getAllByText('Renda')).toHaveLength(2);
    expect(erro.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    erro.mockRestore();
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

  it('uma bolha por mensagem da rajada, e o que aconteceria com o card', async () => {
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
    expect(await screen.findByText('Já te passo pro time.')).toBeInTheDocument();
    const painel = screen.getByRole('complementary', { name: 'O que ela está fazendo' });
    expect(within(painel).getByText('Passaria pra Roleta Zona Sul agora')).toBeInTheDocument();
    expect(within(painel).getByText('Motivo pro corretor: Pediu uma pessoa')).toBeInTheDocument();
    expect(within(painel).getByText('Card: vai pra coluna de "Passou pro corretor"')).toBeInTheDocument();
    expect(within(painel).getByText('No atendimento real ela não responderia')).toBeInTheDocument();
    expect(within(painel).getByText('Fora do horário de atendimento')).toBeInTheDocument();
    expect(within(painel).getAllByText(/respondeu mesmo assim/)).toHaveLength(1);
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
    expect(rehearsal.mock.calls[1][1]).toEqual({ step: 'advance', state: a, hours: null, honor_triggers: false });
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

  it('os cartões de cenário; escolher um mostra a frase dele e manda o histórico como semente', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Que bom que voltou!', estado()));
    abrir();
    const cartoes = screen.getAllByRole('radio').map((r) => r.querySelector('span')?.textContent);
    expect(cartoes).toEqual(['Conversa livre', 'Chegou pelo anúncio', 'Preencheu o formulário', 'Sumiu e voltou', 'Pede um corretor']);
    expect(screen.getByRole('radio', { name: /^Conversa livre/ })).toHaveAttribute('aria-checked', 'true');
    await cenario('Sumiu e voltou');
    expect(screen.getByText('Parou de responder há 3 dias e voltou. Ela retoma de onde parou, sem se reapresentar.')).toBeInTheDocument();
    expect(screen.getByText('quero saber do apartamento de 2 quartos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Que bom que voltou!');
    expect(rehearsal.mock.calls[0][1]).toMatchObject({
      step: 'turn', state: null, message: 'oi, desculpa a demora, é pra morar',
      seed: { hours_ago: 72, history: [{ role: 'user', content: 'quero saber do apartamento de 2 quartos' }, { role: 'assistant', content: 'Boa! É pra morar ou investir?' }] },
    });
  });

  // Pedido do dono do produto (07/10): escolher um nome é um passo a mais que faz desistir de testar.
  it('o lead do teste é quem está testando: sem campo de nome, vai o primeiro nome', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi Tony!', estado()));
    abrir();
    expect(screen.queryByLabelText('Nome do lead')).not.toBeInTheDocument();
    expect(screen.getByText('Tony')).toBeInTheDocument();
    await cenario('Chegou pelo anúncio');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Oi Tony!');
    expect(rehearsal.mock.calls[0][1]).toMatchObject({ context: { contact_name: 'Tony', source: 'Anúncio Instagram — clique para WhatsApp' } });
  });

  it('não tem mais "Salvar este cenário" nem campos de origem e formulário', () => {
    abrir();
    expect(screen.queryByRole('button', { name: 'Salvar este cenário' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('De onde veio')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Respostas do formulário')).not.toBeInTheDocument();
  });

  it('cenário SUBSTITUI o teste: a conversa anterior some e o próximo turno começa do zero', async () => {
    rehearsal.mockResolvedValueOnce(resposta('Oi!', estado())).mockResolvedValueOnce(resposta('Olá Camila', estado()));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await screen.findByText('Oi!');
    await cenario('Chegou pelo anúncio');
    expect(screen.queryByText('Oi!')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Olá Camila');
    expect(rehearsal.mock.calls[1][1]).toMatchObject({ step: 'turn', state: null, message: 'oi, vi o anúncio' });
  });

  it('usar a conversa de um lead real só pede o telefone e só lê', async () => {
    const carregado = estado({ messages: [{ id: 'm1', role: 'user', content: 'oi, é do anúncio?', at: '2026-10-06T13:00:00-03:00', marks: {} }] });
    rehearsal.mockResolvedValueOnce(resultado({ kind: 'loaded', outcome: outcome({ opening: 'Campanha Vivaz' }) }, carregado));
    abrir();
    expect(screen.queryByLabelText('Telefone com DDD')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
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
  // ── 07/10/2026: celular com cara de WhatsApp, gatilho e formulário de verdade ──

  it('esperando a resposta: os três pontinhos e o "digitando…" no topo; depois, tiques azuis', async () => {
    let responder: (r: RehearsalResult) => void = () => {};
    rehearsal.mockReturnValueOnce(new Promise((ok) => { responder = ok; }));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    expect(screen.getByLabelText('enviada')).toBeInTheDocument();
    expect(await screen.findByTestId('digitando')).toBeInTheDocument();
    expect(screen.getByText('digitando…')).toBeInTheDocument();
    responder(resposta('Oi!', estado({ messages: [{ id: 'm1', role: 'user', content: 'oi', at: '2026-10-06T14:01:00-03:00', marks: {} }] })));
    await screen.findByText('Oi!');
    await waitFor(() => expect(screen.queryByTestId('digitando')).not.toBeInTheDocument());
    expect(screen.getByLabelText('lida')).toBeInTheDocument();
    expect(screen.getByText('14:01')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  it('ela calada: os tiques ficam cinza', async () => {
    rehearsal.mockResolvedValueOnce(resultado({ kind: 'silent', outcome: outcome({ skipped: { reason: 'paused_by_human', text: 'A IA está pausada' } }) }, estado()));
    abrir();
    await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
    await within(screen.getByTestId('celular-do-testar')).findByText('Ela ficaria calada: A IA está pausada');
    expect(screen.getByLabelText('entregue')).toBeInTheDocument();
  });

  describe('Respeitar o gatilho', () => {
    const comGatilho = { ...agent, triggers: [{ type: 'keyword', value: 'fluxoimob' }] } as unknown as SalesAgent;

    it('IA sem gatilho: o interruptor não aparece', () => {
      abrir();
      expect(screen.queryByRole('switch', { name: 'Respeitar o gatilho' })).not.toBeInTheDocument();
    });

    it('começa desligado: ela responde, e o aviso aparece uma vez só', async () => {
      const aviso = { reason: 'trigger_no_match', text: 'Nenhum gatilho de ativação bateu com esta conversa' };
      rehearsal.mockResolvedValueOnce(resposta('Oi!', estado(), outcome({ warnings: [aviso] })))
        .mockResolvedValueOnce(resposta('Pra morar?', estado(), outcome({ warnings: [aviso] })));
      abrir(comGatilho);
      expect(screen.getByRole('switch', { name: 'Respeitar o gatilho' })).not.toBeChecked();
      await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
      await screen.findByText('Oi!');
      await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'quero ver{Enter}');
      await screen.findByText('Pra morar?');
      const celular = screen.getByTestId('celular-do-testar');
      expect(within(celular).getAllByText(/No atendimento real ela não entraria aqui/)).toHaveLength(1);
      expect(rehearsal.mock.calls[0][1]).toMatchObject({ step: 'turn', honor_triggers: false });
    });

    it('ligado: manda respeitar, e quando ela cala a linha ensina a desligar', async () => {
      rehearsal.mockResolvedValueOnce(resultado({
        kind: 'silent', outcome: outcome({ skipped: { reason: 'trigger_no_match', text: 'Nenhum gatilho de ativação bateu com esta conversa' } }),
      }, estado()));
      abrir(comGatilho);
      await userEvent.click(screen.getByRole('switch', { name: 'Respeitar o gatilho' }));
      await userEvent.type(screen.getByLabelText('Mensagem do lead'), 'oi{Enter}');
      expect(await screen.findByText(/Desligue "Respeitar o gatilho" pra ver como ela responderia/)).toBeInTheDocument();
      expect(rehearsal.mock.calls[0][1]).toMatchObject({ honor_triggers: true });
    });
  });

  describe('Preencheu o formulário', () => {
    const comFormulario = { ...agent, triggers: [{ type: 'form', form_ids: ['F1', 'F2'] }] } as unknown as SalesAgent;
    const forms = [
      { form_id: 'F1', name: 'Residencial Aurora', answers: { faixa_de_investimento: 'até 300 mil' }, origin: 'lead', last_lead_at: '2026-10-01T10:00:00-03:00', ad_referral: { form_id: 'F1', form_name: 'Aurora' } },
      { form_id: 'F2', name: 'Torre Sul', answers: { 'número_de_quartos': '3' }, origin: 'lead', last_lead_at: '2026-10-06T10:00:00-03:00', ad_referral: { form_id: 'F2', form_name: 'Torre Sul' } },
    ];

    it('IA sem gatilho de formulário: respostas de exemplo, sem ler formulário', async () => {
      abrir();
      await cenario('Preencheu o formulário');
      expect(rehearsalForms).not.toHaveBeenCalled();
      expect(screen.getByText('Faixa de investimento')).toBeInTheDocument();
      expect(screen.getByText('Até 450 mil')).toBeInTheDocument();
    });

    it('com gatilho: abre no formulário que recebeu lead por último e o lead do teste leva ele', async () => {
      rehearsalForms.mockResolvedValueOnce(forms);
      rehearsal.mockResolvedValueOnce(resposta('Oi! Vi que você quer 3 quartos', estado()));
      abrir(comFormulario);
      await cenario('Preencheu o formulário');
      const seletor = await screen.findByLabelText('Formulário');
      expect(seletor).toHaveValue('F2');
      expect(screen.getByText('Número de quartos')).toBeInTheDocument();
      expect(screen.getByText(/Respostas do último lead que chegou por este formulário/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
      await screen.findByText('Oi! Vi que você quer 3 quartos');
      expect(rehearsal.mock.calls[0][1]).toMatchObject({
        context: { form_answers: { 'número_de_quartos': '3' }, ad_referral: { form_id: 'F2', form_name: 'Torre Sul' } },
      });
    });

    it('trocar de formulário recomeça o teste com as respostas dele', async () => {
      rehearsalForms.mockResolvedValueOnce(forms);
      abrir(comFormulario);
      await cenario('Preencheu o formulário');
      await userEvent.selectOptions(await screen.findByLabelText('Formulário'), 'F1');
      expect(screen.getByText('até 300 mil')).toBeInTheDocument();
      expect(screen.queryByText('Número de quartos')).not.toBeInTheDocument();
      expect(rehearsalForms).toHaveBeenCalledTimes(1);
    });

    it('formulário sem lead ainda: respostas de exemplo e o aviso', async () => {
      rehearsalForms.mockResolvedValueOnce([{ form_id: 'F1', name: 'Residencial Aurora', answers: {}, origin: 'none', last_lead_at: null, ad_referral: { form_id: 'F1' } }]);
      abrir(comFormulario);
      await cenario('Preencheu o formulário');
      expect(await screen.findByText('Residencial Aurora')).toBeInTheDocument();
      expect(screen.queryByLabelText('Formulário')).not.toBeInTheDocument();
      expect(screen.getByText('Até 450 mil')).toBeInTheDocument();
      expect(screen.getByText('Ainda não chegou lead por este formulário: usando respostas de exemplo.')).toBeInTheDocument();
    });
  });
});
