import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega o push-sw.js de verdade num "self" falso e dispara os eventos.
const codigo = readFileSync(resolve(__dirname, '../../../public/push-sw.js'), 'utf8');

function montarSw() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const promessas: Promise<unknown>[] = [];
  const fetchFalso = vi.fn(() => Promise.resolve({ ok: true, status: 204 }));
  const self = {
    addEventListener: (nome: string, fn: (e: unknown) => void) => { handlers[nome] = fn; },
    registration: { showNotification: vi.fn(() => Promise.resolve()), pushManager: { subscribe: vi.fn() } },
    clients: { matchAll: vi.fn(() => Promise.resolve([])), openWindow: vi.fn(() => Promise.resolve()) },
    location: { origin: 'https://app.lmflow.com.br' },
  };
  new Function('self', 'fetch', codigo)(self, fetchFalso);
  const disparar = (nome: string, extra: Record<string, unknown>) =>
    handlers[nome]({ waitUntil: (p: Promise<unknown>) => promessas.push(p), ...extra });
  return { self, fetchFalso, disparar, esperar: () => Promise.all(promessas) };
}

const push = (payload: Record<string, unknown>) => ({ data: { json: () => payload, text: () => '' } });

describe('push-sw.js', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra a notificação e manda o recibo "shown" em text/plain', async () => {
    const sw = montarSw();
    sw.disparar('push', push({ title: 'Lead novo', body: 'Maria', url: '/conversations/1', receipt: 'R1', receipt_url: 'https://api.x/api/v1/push/receipts' }));
    await sw.esperar();
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith('Lead novo', expect.objectContaining({ body: 'Maria' }));
    expect(sw.fetchFalso).toHaveBeenCalledWith('https://api.x/api/v1/push/receipts', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ receipt: 'R1', event: 'shown' }),
    }));
  });

  it('push sem recibo (servidor antigo) não chama a rede', async () => {
    const sw = montarSw();
    sw.disparar('push', push({ title: 'Oi', body: 'x' }));
    await sw.esperar();
    expect(sw.fetchFalso).not.toHaveBeenCalled();
  });

  it('clique manda "clicked" e abre o destino', async () => {
    const sw = montarSw();
    const notification = { close: vi.fn(), data: { url: '/conversations/1', receipt: 'R1', receipt_url: 'https://api.x/r' } };
    sw.disparar('notificationclick', { notification });
    await sw.esperar();
    expect(sw.fetchFalso).toHaveBeenCalledWith('https://api.x/r', expect.objectContaining({ body: JSON.stringify({ receipt: 'R1', event: 'clicked' }) }));
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith('/conversations/1');
  });

  it('falha de rede no recibo não derruba a notificação', async () => {
    const sw = montarSw();
    sw.fetchFalso.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    sw.disparar('push', push({ title: 'Oi', body: 'x', receipt: 'R', receipt_url: 'https://api.x/r' }));
    await expect(sw.esperar()).resolves.toBeDefined();
    expect(sw.self.registration.showNotification).toHaveBeenCalled();
  });
});

// Som do Plantão (11/11/2026). Aviso de lead (`event` alto) pergunta às abas do
// LM Flow se alguma tocou o Chegou: se tocou, o aviso do sistema sai calado (sem
// som em dobro); se nenhuma tocou (sem aba, navegador bloqueou o som, aba muda),
// sai com o som do sistema. E fica parado na tela até o corretor clicar.
type Resposta = { played: boolean } | 'muda';

function aba(resposta: Resposta) {
  const recebidas: unknown[] = [];
  return {
    recebidas,
    url: 'https://app.lmflow.com.br/pipelines',
    postMessage: vi.fn((msg: unknown, portas: MessagePort[]) => {
      recebidas.push(msg);
      if (resposta !== 'muda') portas[0].postMessage(resposta);
    }),
  };
}

function montarComAbas(abas: ReturnType<typeof aba>[]) {
  const sw = montarSw();
  sw.self.clients.matchAll = vi.fn(() => Promise.resolve(abas as never[]));
  return sw;
}

const opcoes = (sw: ReturnType<typeof montarSw>) =>
  (sw.self.registration.showNotification.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];

describe('push-sw.js — aviso de lead toca o Chegou na aba', () => {
  afterEach(() => vi.useRealTimers());

  for (const event of ['roleta.oferta_recebida', 'lead.atribuido']) {
    it(`${event}: uma aba tocou → aviso do sistema calado e parado na tela`, async () => {
      const a = aba({ played: true });
      const sw = montarComAbas([a]);
      sw.disparar('push', push({ title: 'Novo lead na sua fila', body: 'Maria', url: '/roleta/aceite/x', event }));
      await sw.esperar();
      expect(a.recebidas).toEqual([{ type: 'lmflow:lead-alert', event, url: '/roleta/aceite/x' }]);
      expect(opcoes(sw)).toMatchObject({ silent: true, requireInteraction: true });
    });
  }

  it('sem aba aberta → aviso com o som do sistema, parado na tela', async () => {
    const sw = montarComAbas([]);
    sw.disparar('push', push({ title: 'Lead novo para você', body: 'Maria', event: 'lead.atribuido' }));
    await sw.esperar();
    expect(opcoes(sw).requireInteraction).toBe(true);
    expect(opcoes(sw).silent).toBeFalsy();
  });

  it('aba respondeu que não conseguiu tocar → som do sistema', async () => {
    const sw = montarComAbas([aba({ played: false })]);
    sw.disparar('push', push({ title: 'x', body: 'y', event: 'lead.atribuido' }));
    await sw.esperar();
    expect(opcoes(sw).silent).toBeFalsy();
  });

  it('duas abas, só a líder tocou → calado', async () => {
    const sw = montarComAbas([aba({ played: false }), aba({ played: true })]);
    sw.disparar('push', push({ title: 'x', body: 'y', event: 'roleta.oferta_recebida' }));
    await sw.esperar();
    expect(opcoes(sw).silent).toBe(true);
  });

  it('aba que não responde em 1,5 s → som do sistema', async () => {
    vi.useFakeTimers();
    const sw = montarComAbas([aba('muda')]);
    sw.disparar('push', push({ title: 'x', body: 'y', event: 'roleta.oferta_recebida' }));
    await vi.advanceTimersByTimeAsync(1_500);
    await sw.esperar();
    expect(opcoes(sw).silent).toBeFalsy();
    expect(opcoes(sw).requireInteraction).toBe(true);
  });

  it('push sem event (mensagem, servidor antigo, push manual) segue como sempre', async () => {
    const a = aba({ played: true });
    const sw = montarComAbas([a]);
    sw.disparar('push', push({ title: 'Nova mensagem', body: 'oi', url: '/conversations/1' }));
    await sw.esperar();
    expect(a.postMessage).not.toHaveBeenCalled();
    expect(opcoes(sw).silent).toBeUndefined();
    expect(opcoes(sw).requireInteraction).toBeUndefined();
  });

  it('push com event que não é de lead segue como sempre', async () => {
    const a = aba({ played: true });
    const sw = montarComAbas([a]);
    sw.disparar('push', push({ title: 'x', body: 'y', event: 'conversa.mensagem_nova' }));
    await sw.esperar();
    expect(a.postMessage).not.toHaveBeenCalled();
    expect(opcoes(sw).requireInteraction).toBeUndefined();
  });
});
