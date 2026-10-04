import { describe, it, expect, vi, beforeEach } from 'vitest';
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
