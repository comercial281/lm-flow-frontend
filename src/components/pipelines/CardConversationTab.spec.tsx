// Card do lead → aba Conversa: falha ao ler as mensagens não pode virar
// "Nenhuma mensagem ainda." (o corretor concluiria que nunca falou com o lead).
// 404 é vazio honesto; outra falha com a lista vazia é erro com Tentar de novo;
// a releitura de fundo (8 em 8 s) que falha com mensagens na tela fica calada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getMessages = vi.hoisted(() => vi.fn());
const transcribeAttachment = vi.hoisted(() => vi.fn());
const sendMessage = vi.hoisted(() => vi.fn());
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { getMessages, sendMessage, transcribeAttachment },
}));
// Tempo real: guarda o handler que a aba registra (registerHandlers estável, como o do provider).
const ws = vi.hoisted(() => {
  const estado: { onMessageCreated?: (m: unknown) => void } = {};
  const registerHandlers = (h: { onMessageCreated?: (m: unknown) => void }) => { estado.onMessageCreated = h.onMessageCreated; };
  return { estado, registerHandlers };
});
vi.mock('@/contexts/chat/WebSocketContext', () => ({
  useWebSocketContext: () => ({ registerHandlers: ws.registerHandlers }),
}));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { archiveConversation: vi.fn(), unarchiveConversation: vi.fn() },
}));
vi.mock('@/components/chat/message-funnels/DispararFunilPanel', () => ({ DispararFunilPanel: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CardConversationTab from './CardConversationTab';
import type { PipelineItem } from '@/types/analytics';

const item = { id: 'i1', item_id: 'c-10', type: 'conversation', conversation: { id: 10 } } as unknown as PipelineItem;

const msg = (id: number, content: string) => ({
  id, content, message_type: 0, created_at: 1_760_000_000, attachments: [], sender: { name: 'Ana' },
});

const falha = (status: number) => Object.assign(new Error(String(status)), { response: { status } });

// jsdom não mede altura nem guarda scrollTop: a caixa finge 2000 px de conteúdo
// numa janela de 500 px e lembra a rolagem.
const rolagens = new WeakMap<Element, number>();
beforeEach(() => {
  getMessages.mockReset();
  transcribeAttachment.mockReset();
  sendMessage.mockReset();
  ws.estado.onMessageCreated = undefined;
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 2000 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) { return rolagens.get(this) ?? 0; },
    set(this: Element, v: number) { rolagens.set(this, v); },
  });
});
afterEach(() => {
  vi.useRealTimers();
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  delete (HTMLElement.prototype as { scrollTop?: number }).scrollTop;
});

describe('Card do lead → Conversa · erro de carga', () => {
  it('(a) primeira carga que falha com 500 mostra Tentar de novo, não "Nenhuma mensagem ainda."', async () => {
    getMessages.mockRejectedValue(falha(500));
    render(<CardConversationTab item={item} />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.queryByText('Nenhuma mensagem ainda.')).toBeNull();

    getMessages.mockResolvedValue([msg(1, 'Oi, tudo bem?')]);
    await userEvent.click(botao);
    expect(await screen.findByText('Oi, tudo bem?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('(b) 404 é vazio honesto: "Nenhuma mensagem ainda."', async () => {
    getMessages.mockRejectedValue(falha(404));
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Nenhuma mensagem ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('(c) releitura de fundo que falha com mensagens na tela: as mensagens ficam e nenhum erro aparece', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockResolvedValueOnce([msg(1, 'Primeira'), msg(2, 'Segunda')]);
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Primeira')).toBeInTheDocument();

    getMessages.mockRejectedValue(falha(500));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Primeira')).toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.queryByText('Não deu pra carregar')).toBeNull();
  });
});

// 100 mensagens; a de número n tem created_at crescente.
const conversa = (n: number) => ({
  id: n, content: `Mensagem ${n}`, message_type: n % 2 ? 0 : 1, created_at: 1_760_000_000 + n * 60,
  attachments: [], sender: { name: 'Ana' },
});
const trecho = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => conversa(de + i));
// Servidor falso: sem cursor = as 20 últimas; before = as 20 anteriores à mensagem.
const servidor = (ultima = 100) => (_id: string, params?: { before?: string }) => {
  const fim = params?.before ? Number(params.before) - 1 : ultima;
  return Promise.resolve(trecho(Math.max(1, fim - 19), fim));
};
const caixa = () => screen.getByTestId('caixa-da-conversa');
const rolarPara = (top: number) => { caixa().scrollTop = top; fireEvent.scroll(caixa()); };

describe('Card do lead → Conversa · mensagens antigas e rolagem', () => {
  it('abre no fim da caixa e sem scrollIntoView (a página do card não se mexe)', async () => {
    getMessages.mockImplementation(servidor());
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Mensagem 100')).toBeInTheDocument();
    expect(caixa().scrollTop).toBe(2000);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('chegar no topo pede as 20 anteriores (before = mais antiga) e mantém o lugar', async () => {
    // A caixa cresce com o conteúdo (100 px por linha): 20 mensagens = 2000 px, 40 = 4000 px.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.testid === 'caixa-da-conversa' ? this.childElementCount * 100 : 2000;
      },
    });
    getMessages.mockImplementation(servidor());
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 81');
    expect(caixa().scrollTop).toBe(2000);

    rolarPara(10);

    expect(await screen.findByText('Mensagem 61')).toBeInTheDocument();
    expect(getMessages).toHaveBeenLastCalledWith('10', { before: '81' });
    // Entraram 20 linhas (2000 px) em cima: a mesma mensagem continua na frente.
    expect(caixa().scrollTop).toBe(10 + 2000);
  });

  it('sobe até o começo: "Início da conversa" e para de pedir', async () => {
    getMessages.mockImplementation(servidor(30));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 11');
    expect(screen.queryByText('Início da conversa')).toBeNull();

    rolarPara(0);

    expect(await screen.findByText('Mensagem 1')).toBeInTheDocument();
    expect(screen.getByText('Início da conversa')).toBeInTheDocument();
    const chamadas = getMessages.mock.calls.length;
    rolarPara(0);
    expect(getMessages.mock.calls.length).toBe(chamadas);
  });

  it('conversa curta: "Início da conversa" sem pedir anteriores', async () => {
    getMessages.mockResolvedValue([conversa(1), conversa(2)]);
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Início da conversa')).toBeInTheDocument();
    rolarPara(0);
    expect(getMessages).toHaveBeenCalledTimes(1);
  });

  it('releitura de 8 s depois de carregar antigas: as antigas continuam', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockImplementation(servidor());
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 81');
    rolarPara(0);
    await screen.findByText('Mensagem 61');

    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(screen.getByText('Mensagem 61')).toBeInTheDocument();
    expect(screen.getByText('Mensagem 100')).toBeInTheDocument();
  });

  it('mensagem apagada no trecho recente some na releitura', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockResolvedValueOnce([conversa(1), conversa(2), conversa(3)]);
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 2');

    getMessages.mockResolvedValue([conversa(1), conversa(3)]);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(screen.queryByText('Mensagem 2')).toBeNull();
    expect(screen.getByText('Mensagem 3')).toBeInTheDocument();
  });

  it('erro ao carregar anteriores: linha com Tentar de novo e as mensagens ficam', async () => {
    getMessages.mockImplementation((_id: string, params?: { before?: string }) =>
      params?.before ? Promise.reject(falha(500)) : Promise.resolve(trecho(81, 100)));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 81');

    rolarPara(0);

    const linha = (await screen.findByText('Não deu pra carregar as anteriores')).parentElement as HTMLElement;
    expect(screen.getByText('Mensagem 81')).toBeInTheDocument();

    getMessages.mockImplementation(servidor());
    await userEvent.click(within(linha).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Mensagem 61')).toBeInTheDocument();
    expect(screen.queryByText('Não deu pra carregar as anteriores')).toBeNull();
  });

  it('mensagem nova lendo o histórico: não pula e mostra "Nova mensagem"; tocar leva pro fim', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockImplementation(servidor(100));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 100');

    caixa().scrollTop = 600; // lendo pra cima (2000 - 600 - 500 = 900 px do fim)
    getMessages.mockImplementation(servidor(101));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(await screen.findByText('Mensagem 101')).toBeInTheDocument();
    expect(caixa().scrollTop).toBe(600);
    await userEvent.click(screen.getByRole('button', { name: /Nova mensagem/ }));
    expect(caixa().scrollTop).toBe(2000);
    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });

  it('mensagem nova estando no fim: desce sozinho, sem botão', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockImplementation(servidor(100));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 100');
    caixa().scrollTop = 1450; // 50 px do fim

    getMessages.mockImplementation(servidor(101));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(await screen.findByText('Mensagem 101')).toBeInTheDocument();
    expect(caixa().scrollTop).toBe(2000);
    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });

  it('releitura no meio da carga de anteriores: nenhuma das duas some', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let soltarAnteriores: (v: unknown) => void = () => {};
    getMessages.mockImplementation((_id: string, params?: { before?: string }) =>
      params?.before ? new Promise(r => { soltarAnteriores = r; }) : Promise.resolve(trecho(81, 100)));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 81');
    rolarPara(0);
    expect(await screen.findByText('Carregando mensagens anteriores…')).toBeInTheDocument();

    getMessages.mockImplementation((_id: string, params?: { before?: string }) =>
      params?.before ? new Promise(r => { soltarAnteriores = r; }) : Promise.resolve(trecho(82, 101)));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    await act(async () => { soltarAnteriores(trecho(61, 80)); });

    expect(await screen.findByText('Mensagem 61')).toBeInTheDocument();
    expect(screen.getByText('Mensagem 81')).toBeInTheDocument();
    expect(screen.getByText('Mensagem 101')).toBeInTheDocument();
  });

  it('caixa que não rola carrega sozinha até encher ou acabar', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 });
    getMessages.mockImplementation(servidor(45));
    render(<CardConversationTab item={item} />);
    expect(await screen.findByText('Mensagem 1')).toBeInTheDocument();
    expect(screen.getByText('Início da conversa')).toBeInTheDocument();
    expect(getMessages).toHaveBeenCalledWith('10', { before: '26' });
    expect(getMessages).toHaveBeenCalledWith('10', { before: '6' });
  });

  it('troca de conversa descarta resposta velha', async () => {
    let soltarVelha: (v: unknown) => void = () => {};
    getMessages.mockImplementation((id: string) =>
      id === '10' ? new Promise(r => { soltarVelha = r; }) : Promise.resolve([conversa(7)]));
    const { rerender } = render(<CardConversationTab item={item} />);
    const outro = { ...item, id: 'i2', item_id: 'c-11', conversation: { id: 11 } } as unknown as PipelineItem;
    rerender(<CardConversationTab item={outro} />);
    expect(await screen.findByText('Mensagem 7')).toBeInTheDocument();

    await act(async () => { soltarVelha(trecho(81, 100)); });

    expect(screen.queryByText('Mensagem 81')).toBeNull();
    expect(screen.getByText('Mensagem 7')).toBeInTheDocument();
  });

  it('troca de conversa: a resposta velha não tira o "carregando" da nova', async () => {
    let soltarVelha: (v: unknown) => void = () => {};
    let soltarNova: (v: unknown) => void = () => {};
    getMessages.mockImplementation((id: string) =>
      new Promise(r => { if (id === '10') soltarVelha = r; else soltarNova = r; }));
    const { rerender } = render(<CardConversationTab item={item} />);
    const outro = { ...item, id: 'i2', item_id: 'c-11', conversation: { id: 11 } } as unknown as PipelineItem;
    rerender(<CardConversationTab item={outro} />);

    await act(async () => { soltarVelha(trecho(81, 100)); });

    expect(screen.queryByText('Nenhuma mensagem ainda.')).toBeNull();
    expect(screen.queryByText('Mensagem 81')).toBeNull();

    await act(async () => { soltarNova([conversa(7)]); });
    expect(screen.getByText('Mensagem 7')).toBeInTheDocument();
  });

  it('"Nova mensagem" some quando a pessoa volta pro fim rolando', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockImplementation(servidor(100));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 100');
    caixa().scrollTop = 600;
    getMessages.mockImplementation(servidor(101));
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(await screen.findByRole('button', { name: /Nova mensagem/ })).toBeInTheDocument();

    rolarPara(1450); // 50 px do fim

    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });

  it('anteriores que não avançam (a mais antiga foi apagada): para de pedir', async () => {
    // O servidor ignora o before de mensagem apagada e devolve as 20 últimas de novo.
    getMessages.mockImplementation(() => Promise.resolve(trecho(81, 100)));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 81');

    rolarPara(0);

    expect(await screen.findByText('Início da conversa')).toBeInTheDocument();
    const chamadas = getMessages.mock.calls.length;
    rolarPara(0);
    expect(getMessages.mock.calls.length).toBe(chamadas);
  });

  it('anteriores que não avançam com a caixa que não enche: não fica em loop', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 });
    getMessages.mockImplementation(() => Promise.resolve(trecho(81, 100)));
    render(<CardConversationTab item={item} />);

    expect(await screen.findByText('Início da conversa')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 50));
    expect(getMessages).toHaveBeenCalledTimes(2);
  });
});

const doTempoReal = (n: number) => ({ ...conversa(n), conversation_id: '10' });
const escreverEEnviar = async (texto: string) => {
  await userEvent.type(screen.getByPlaceholderText('Responder no WhatsApp...'), texto);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
};

describe('Card do lead → Conversa · tempo real e envio', () => {
  it('mensagem do tempo real antes da primeira página: a página ainda decide as anteriores e abre no fim', async () => {
    let soltarPagina: (v: unknown) => void = () => {};
    getMessages.mockImplementation((id: string, params?: { before?: string }) =>
      params?.before ? servidor()(id, params) : new Promise(r => { soltarPagina = r; }));
    render(<CardConversationTab item={item} />);
    await waitFor(() => expect(ws.estado.onMessageCreated).toBeDefined());

    act(() => { ws.estado.onMessageCreated?.(doTempoReal(100)); });
    expect(await screen.findByText('Mensagem 100')).toBeInTheDocument();
    caixa().scrollTop = 0; // a primeira página vai entrar em cima: a caixa não está mais no fim

    await act(async () => { soltarPagina(trecho(81, 100)); });

    expect(await screen.findByText('Mensagem 81')).toBeInTheDocument();
    expect(screen.queryByText('Início da conversa')).toBeNull();
    expect(caixa().scrollTop).toBe(2000);
    rolarPara(0);
    expect(await screen.findByText('Mensagem 61')).toBeInTheDocument();
    expect(getMessages).toHaveBeenCalledWith('10', { before: '81' });
  });

  it('primeira carga falhou e chegou mensagem pelo tempo real: a próxima releitura decide as anteriores', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMessages.mockRejectedValueOnce(falha(500));
    render(<CardConversationTab item={item} />);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();

    act(() => { ws.estado.onMessageCreated?.(doTempoReal(100)); });
    expect(await screen.findByText('Mensagem 100')).toBeInTheDocument();

    getMessages.mockImplementation(servidor());
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(await screen.findByText('Mensagem 81')).toBeInTheDocument();
    expect(screen.queryByText('Início da conversa')).toBeNull();
    rolarPara(0);
    expect(await screen.findByText('Mensagem 61')).toBeInTheDocument();
  });

  it('enviar lendo o histórico leva pro fim, sem "Nova mensagem"', async () => {
    getMessages.mockImplementation(servidor(100));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 100');
    caixa().scrollTop = 600;

    sendMessage.mockImplementation(async () => {
      getMessages.mockImplementation(servidor(101));
      return conversa(101);
    });
    await escreverEEnviar('Oi');

    expect(await screen.findByText('Mensagem 101')).toBeInTheDocument();
    await waitFor(() => expect(caixa().scrollTop).toBe(2000));
    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });

  it('enviar lendo o histórico com o eco do tempo real chegando antes: leva pro fim, sem "Nova mensagem"', async () => {
    getMessages.mockImplementation(servidor(100));
    render(<CardConversationTab item={item} />);
    await screen.findByText('Mensagem 100');
    await waitFor(() => expect(ws.estado.onMessageCreated).toBeDefined());
    caixa().scrollTop = 600;

    sendMessage.mockImplementation(async () => {
      // O eco da própria mensagem chega pelo tempo real antes da resposta do envio.
      act(() => { ws.estado.onMessageCreated?.(doTempoReal(101)); });
      getMessages.mockImplementation(servidor(101));
      return conversa(101);
    });
    await escreverEEnviar('Oi');

    expect(await screen.findByText('Mensagem 101')).toBeInTheDocument();
    await waitFor(() => expect(caixa().scrollTop).toBe(2000));
    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });
});
